import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readdir, symlink, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DAY, lastActivity, actionFor, removeLogGenerations, sweep} from '../src/retention.js';
const config = {archiveAfterDays: 5, deleteAfterDays: 14};
test('strict thresholds and archive required', () => {
  const now = 100 * DAY;
  assert.equal(actionFor(now - 5 * DAY, false, now, config), 'skip');
  assert.equal(actionFor(now - 5 * DAY - 1, false, now, config), 'archive');
  assert.equal(actionFor(now - 14 * DAY, true, now, config), 'skip');
  assert.equal(actionFor(now - 14 * DAY - 1, true, now, config), 'delete');
  assert.equal(actionFor(now - 20 * DAY, false, now, config), 'archive');
  assert.equal(actionFor(NaN, true, now, config), 'skip');
  assert.equal(actionFor(now + 1, true, now, config), 'skip');
});
test('last activity includes all events and refuses invalid timestamps', () => {
  assert.equal(lastActivity({createdAt: 100}, [{time: 200}, {time: 150}]), 200);
  assert.ok(Number.isNaN(lastActivity({createdAt: 100}, [{time: NaN}])));
});
test('remove only canonical generations, retaining lock inode', async () => {
  const dir = await mkdtemp(join(await realpath(tmpdir()), 'retention-test-'));
  for (const name of ['session.jsonl', 'session.v3.jsonl', 'session.lock']) await writeFile(join(dir, name), 'fixture');
  assert.equal(await removeLogGenerations({kind: 'jsonl', path: join(dir, 'session.v3.jsonl')}), 2);
  assert.deepEqual(await readdir(dir), ['session.lock']);
});
test('unknown files and symlinks fail closed', async () => {
  const dir = await mkdtemp(join(await realpath(tmpdir()), 'retention-test-'));
  await writeFile(join(dir, 'session.jsonl'), 'fixture');
  await writeFile(join(dir, 'important.txt'), 'keep');
  await assert.rejects(removeLogGenerations({kind: 'jsonl', path: join(dir, 'session.jsonl')}), /Unexpected/);
  const other = await mkdtemp(join(await realpath(tmpdir()), 'retention-link-test-'));
  await symlink(join(dir, 'session.jsonl'), join(other, 'session.jsonl'));
  await assert.rejects(removeLogGenerations({kind: 'jsonl', path: join(other, 'session.jsonl')}), /Unsafe/);
});
test('sweep archives cold sessions and skips loaded and pinned ones', async () => {
  const ids = ['cold', 'loaded', 'pinned'];
  const state = {archivedSessionIds: [], pinnedSessionIds: ['pinned']};
  const archived = [];
  const ctx = {
    storageDomain: {get: () => ({global: {get: () => state}})},
    sessions: {get: id => id === 'loaded'},
    sessionQuery: {
      listSessions: async () => ids.map(id => ({header: {id}})),
      observeSession: async () => ({header: {createdAt: Date.now() - 20 * DAY}, events: [], [Symbol.dispose]() {}}),
    },
    sessionPersistence: {stat: async () => ({})},
    workspaceRegistry: {archiveSession: async id => archived.push(id)},
  };
  const report = await sweep(ctx, config, new AbortController().signal);
  assert.deepEqual(archived, ['cold']);
  assert.equal(report.deleted.length, 0);
  assert.equal(report.errors.length, 0);
});
test('sweep deletes leased archive and cleans workspace membership', async () => {
  const dir = await mkdtemp(join(await realpath(tmpdir()), 'retention-sweep-test-'));
  const path = join(dir, 'session.v3.jsonl');
  await writeFile(path, 'fixture');
  const header = {id: 'old', createdAt: Date.now() - 20 * DAY};
  const state = {archivedSessionIds: ['old'], pinnedSessionIds: []};
  let closed = false, detached = false;
  const snapshot = {header, location: {kind: 'jsonl', path}};
  const ctx = {
    storageDomain: {get: () => ({global: {get: () => state}})},
    sessions: {get() {}},
    sessionQuery: {listSessions: async () => [{header}], observeSession: async () => ({header, events: [], [Symbol.dispose]() {}})},
    sessionPersistence: {stat: async () => snapshot, open: async () => ({header, read: async () => ({events: []}), close: async () => {closed = true;}})},
    workspaceRegistry: {list: () => [{sessionIds: ['old'], detachSession: async () => {detached = true;}}], unarchiveSession: async () => {state.archivedSessionIds = []; }},
  };
  const report = await sweep(ctx, config, new AbortController().signal);
  assert.deepEqual(report.deleted, ['old']);
  assert.deepEqual(report.errors, []);
  assert.ok(closed && detached);
  assert.deepEqual(await readdir(dir), []);
});
