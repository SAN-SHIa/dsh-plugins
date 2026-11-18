import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, realpath, mkdir, readdir, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {publishFile} from '../src/import-files.js';

test('a different resolved directory is refused before any staging write', async t => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'dsh-workspace-drop-pinned-')));
  t.after(async () => {
    assert.ok(path.basename(root).startsWith('dsh-workspace-drop-pinned-'));
    await rm(root, {recursive: true, force: true});
  });
  const authorized = path.join(root, 'authorized');
  const changed = path.join(root, 'changed');
  await mkdir(authorized);
  await mkdir(changed);
  async function* chunks() { yield Buffer.from('data'); }
  await assert.rejects(publishFile(changed, 'test.txt', chunks(), undefined, authorized), /changed before import/);
  assert.deepEqual(await readdir(changed), []);
});
