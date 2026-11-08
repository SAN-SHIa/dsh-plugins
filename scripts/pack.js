import {mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(new URL('../dist/', import.meta.url));
await mkdir(output, {recursive: true});
for (const name of ['ui-enhancements', 'deepseek-search', 'session-auto-name']) {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'pack', `./packages/${name}`, '--pack-destination', output, '--ignore-scripts'], {cwd: root, stdio: 'inherit'});
  if (result.status !== 0) process.exit(result.status ?? 1);
}
