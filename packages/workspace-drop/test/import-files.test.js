import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, realpath, readFile, readdir, writeFile, symlink, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {safeName, publishFile, importReceipts} from '../src/import-files.js';
import {apply} from '../src/host.js';

async function fixture(t) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'dsh-workspace-drop-test-')));
  t.after(async () => {
    // mkdtemp produced this exact owned test directory, not a caller-supplied path.
    assert.ok(path.basename(root).startsWith('dsh-workspace-drop-test-'));
    await rm(root, {recursive: true, force: true});
  });
  return root;
}
async function* bytes(value) { yield Buffer.from(value); }

test('reject path traversal, separators, control characters, and oversized filenames', () => {
  for (const name of ['..', '.', '', '../a', 'a/b', 'a\\b', 'a\0b', 'a\nb', '中'.repeat(100)]) assert.throws(() => safeName(name));
  assert.equal(safeName('中文 report.pdf'), '中文 report.pdf');
});

test('preserve binary contents, empty files, Unicode names, and existing files', async t => {
  const root = await fixture(t);
  const raw = Buffer.from([0, 255, 1, 2, 13, 10]);
  async function* chunks() { yield raw.subarray(0, 2); yield raw.subarray(2); }
  await writeFile(path.join(root, '中文.bin'), 'original');
  const result = await publishFile(root, '中文.bin', chunks());
  assert.equal(result.name, '中文 (1).bin');
  assert.deepEqual(await readFile(result.path), raw);
  assert.equal(await readFile(path.join(root, '中文.bin'), 'utf8'), 'original');
  const empty = await publishFile(root, 'empty.txt', bytes(''));
  assert.equal(empty.bytes, 0);
  assert.equal((await readFile(empty.path)).length, 0);
  assert.ok(!(await readdir(root)).some(name => name.startsWith('.dsh-import-')));
});

test('never follow a conflicting symlink or overwrite during concurrent drops', async t => {
  const root = await fixture(t);
  const outside = path.join(root, 'original.txt');
  await writeFile(outside, 'keep');
  await symlink(outside, path.join(root, 'report.txt'));
  const results = await Promise.all(Array.from({length: 8}, (_, i) => publishFile(root, 'report.txt', bytes(String(i)))));
  assert.equal(new Set(results.map(file => file.path)).size, 8);
  assert.equal(await readFile(outside, 'utf8'), 'keep');
});

test('failed reads and cancellation leave no published or staging file', async t => {
  const root = await fixture(t);
  async function* broken() { yield Buffer.from('partial'); throw new Error('integrity failure'); }
  await assert.rejects(publishFile(root, 'broken.bin', broken()), /integrity/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(publishFile(root, 'aborted.bin', bytes('data'), controller.signal));
  assert.deepEqual(await readdir(root), []);
});

function context(root, overrides = {}) {
  const staged = {type: 'file', attachment: {attachmentId: 'id', name: 'test.txt', bytes: 5}};
  const ctx = {
    workingDirectory: {get: () => root},
    fs: {processPathFromHostPath: value => value, resolve: async value => value, processPath: value => value, contains: (a, b) => a === b},
    sandboxPolicy: {resolve: () => ({mode: 'workspace-write', workspaceRoot: root})},
    fileUploads: {resolve: (_agent, id) => id === 'own-receipt' ? staged : undefined},
    attachments: {readFileStream: () => bytes('hello')},
    ...overrides,
  };
  const agent = {id: 'session', session: {}, ctx: {get: name => ctx[name]}};
  return {ctx, agent};
}

test('reject read-only, nonlocal, foreign receipts, and changed workspace before writing', async t => {
  const root = await fixture(t);
  const {ctx, agent} = context(root);
  await assert.rejects(importReceipts(ctx, agent, {receiptIds: ['foreign']}), /foreign/);
  await assert.rejects(importReceipts(ctx, agent, {receiptIds: ['own-receipt'], workspace: '/different'}), /changed/);
  ctx.sandboxPolicy.resolve = () => ({mode: 'read-only'});
  await assert.rejects(importReceipts(ctx, agent, {receiptIds: ['own-receipt']}), /read-only/);
  ctx.sandboxPolicy.resolve = () => ({mode: 'workspace-write', workspaceRoot: root});
  ctx.fs.processPathFromHostPath = () => undefined;
  await assert.rejects(importReceipts(ctx, agent, {receiptIds: ['own-receipt']}), /local/);
  assert.deepEqual(await readdir(root), []);
});

test('UI command and agent tool share the same import operation and results', async t => {
  const root = await fixture(t);
  const {ctx, agent} = context(root);
  let command, tool, service;
  ctx.commands = {register: value => { command = value; }};
  ctx.tools = {register: value => { tool = value; }};
  ctx.provide = (key, value) => {
    assert.equal(key, 'workspaceDrop');
    service = value;
  };
  apply(ctx);
  assert.equal(typeof service.importFiles, 'function');
  const args = {receiptIds: ['own-receipt']};
  const fromTool = await tool.execute(args, {agent});
  const fromCommand = await command.handler({agent, rawInput: JSON.stringify(args)});
  assert.equal(fromCommand.kind, 'success');
  assert.equal(fromTool.files[0].name, 'test.txt');
  assert.equal(JSON.parse(fromCommand.text).files[0].name, 'test (1).txt');
  assert.equal(await readFile(fromTool.files[0].path, 'utf8'), 'hello');
  const refused = await command.handler({agent, rawInput: JSON.stringify({receiptIds: ['foreign']})});
  assert.equal(refused.kind, 'error');
  await assert.rejects(tool.execute({receiptIds: ['foreign']}, {agent}), /foreign/);
});
