import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = new URL('../', import.meta.url);
for (const folder of ['ui-enhancements', 'deepseek-search', 'session-auto-name']) {
  const base = new URL(`packages/${folder}/`, root);
  const manifest = JSON.parse(await readFile(new URL('package.json', base), 'utf8'));
  assert.equal(manifest.license, 'MIT');
  assert.ok(!manifest.private && !manifest.name.startsWith('@local/'));
  await readFile(new URL('LICENSE', base));
  const patch = await readFile(new URL('cordis.patch.yml', base), 'utf8');
  assert.ok(patch.includes(`name: '${manifest.name}'`));
  if (folder === 'deepseek-search') assert.match(patch, /importCodexCredential: false/);
  async function check(dir) {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
      if (entry.name === 'node_modules') continue;
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) await check(path);
      else if (/\.(js|json|yml|md)$/.test(entry.name)) {
        const text = await readFile(path, 'utf8');
        assert.ok(!/\/Users\//.test(text), `Machine-specific path in ${path}`);
        assert.ok(!/\b(?:sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9_]{30,})\b/.test(text), `Potential secret in ${path}`);
        if (entry.name.endsWith('.js')) {
          const result = spawnSync(process.execPath, ['--check', fileURLToPath(path)], {stdio: 'inherit'});
          assert.equal(result.status, 0);
        }
      }
    }
  }
  await check(base);
}
console.log('Release metadata, syntax, migration defaults, and basic secret checks passed.');
