import z from '@deepseek-ai/schemastery';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {sweep} from './retention.js';

export const inject = ['sessionQuery', 'sessionPersistence', 'sessions', 'workspaceRegistry', 'storageDomain'];
export const Config = z.object({
  archiveAfterDays: z.number().min(1).default(5),
  deleteAfterDays: z.number().min(2).default(14),
  intervalMinutes: z.number().min(1).max(1440).default(60),
  reportDirectory: z.string(),
});
export function apply(ctx, config) {
  if (config.deleteAfterDays <= config.archiveAfterDays) throw new Error('Deletion threshold must exceed archive threshold');
  const reportDir = config.reportDirectory;
  ctx.effect(() => {
    const controller = new AbortController();
    let pending;
    const run = () => {
      if (pending || controller.signal.aborted) return;
      pending = (async () => {
        const report = await sweep(ctx, config, controller.signal);
        await mkdir(reportDir, {recursive: true});
        await writeFile(join(reportDir, 'latest.json'), JSON.stringify(report, null, 2) + '\n', {mode: 0o600});
        console.info('[session-retention]', JSON.stringify({scanned: report.scanned, archived: report.archived.length, deleted: report.deleted.length, errors: report.errors.length}));
      })().catch(error => {
        if (!controller.signal.aborted) console.error('[session-retention]', error);
      }).finally(() => { pending = undefined; });
    };
    const startup = setTimeout(run, 3000);
    const timer = setInterval(run, config.intervalMinutes * 60000);
    return async () => {
      clearTimeout(startup);
      clearInterval(timer);
      controller.abort();
      await pending;
    };
  });
}
