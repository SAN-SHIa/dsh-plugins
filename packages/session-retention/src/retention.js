import {lstat, realpath, readdir, unlink} from 'node:fs/promises';
import {basename, dirname, join, isAbsolute, resolve} from 'node:path';

export const DAY = 86400000;
export function lastActivity(header, events) {
  let time = header.createdAt;
  if (!Number.isFinite(time) || time <= 0) return NaN;
  for (const event of events) {
    if (!Number.isFinite(event.time)) return NaN;
    time = Math.max(time, event.time);
  }
  return time;
}
export function actionFor(time, archived, now, config) {
  if (!Number.isFinite(time) || time > now) return 'skip';
  if (archived && now - time > config.deleteAfterDays * DAY) return 'delete';
  if (!archived && now - time > config.archiveAfterDays * DAY) return 'archive';
  return 'skip';
}

// No recursive removal: only canonical log generations of the exact leased session.
// Keep session.lock and its directory: unlinking a live flock inode breaks exclusion.
export async function removeLogGenerations(location) {
  if (location?.kind !== 'jsonl' || !isAbsolute(location.path)) throw new Error('Unsupported storage location');
  const logName = /^session(?:\.v[1-9]\d*)?\.jsonl(?:\.zstd)?$/;
  const target = resolve(location.path);
  if (!logName.test(basename(target)) || await realpath(target) !== target) throw new Error('Unsafe log path');
  const directory = dirname(target);
  if (await realpath(directory) !== directory) throw new Error('Symlinked session directory');
  const names = await readdir(directory);
  if (names.some(name => name !== 'session.lock' && !logName.test(name))) throw new Error('Unexpected session directory contents');
  const files = [];
  for (const name of names.filter(name => logName.test(name))) {
    const path = join(directory, name);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Unsafe log artifact');
    files.push({path, ino: stat.ino, dev: stat.dev});
  }
  // Remove predecessor generations first, so a partial failure cannot resurrect one.
  files.sort((a, b) => Number(a.path === target) - Number(b.path === target));
  for (const file of files) {
    const current = await lstat(file.path);
    if (current.ino !== file.ino || current.dev !== file.dev || !current.isFile()) throw new Error('Log changed before deletion');
    await unlink(file.path);
  }
  return files.length;
}

export async function sweep(ctx, config, signal) {
  const report = {at: new Date().toISOString(), scanned: 0, archived: [], deleted: [], skipped: [], errors: []};
  const state = () => {
    const value = ctx.storageDomain.get('workspace')?.global.get();
    if (!Array.isArray(value?.archivedSessionIds) || !Array.isArray(value?.pinnedSessionIds)) throw new Error('Unsupported workspace archive state');
    return value;
  };
  state(); // Fail closed if this runtime changes its archive representation.
  const records = await ctx.sessionQuery.listSessions(signal);
  const parents = new Set(records.map(row => row.header.parentSession).filter(Boolean));
  for (const record of records) {
    signal.throwIfAborted();
    const id = record.header.id;
    report.scanned++;
    try {
      if (ctx.sessions.get(id) || state().pinnedSessionIds.includes(id)) { report.skipped.push({id, reason: 'live-or-pinned'}); continue; }
      const snapshot = await ctx.sessionPersistence.stat(id);
      if (!snapshot) continue;
      const observation = await ctx.sessionQuery.observeSession(id, {signal, projectionMode: 'none'});
      let time;
      try { time = lastActivity(observation.header, observation.events); }
      finally { observation[Symbol.dispose](); }
      const action = actionFor(time, state().archivedSessionIds.includes(id), Date.now(), config);
      if (action === 'skip') continue;
      if (action === 'archive') {
        if (!ctx.sessions.get(id)) {
          await ctx.workspaceRegistry.archiveSession(id);
          report.archived.push(id);
        }
        continue; // A newly archived session gets at least one scan interval to review.
      }
      if (parents.has(id)) { report.skipped.push({id, reason: 'has-descendants'}); continue; }
      // The supported write lease excludes writers in this and other processes.
      const handle = await ctx.sessionPersistence.open(id, 'write', {signal});
      try {
        const latest = await ctx.sessionPersistence.stat(id);
        const {events} = await handle.read();
        if (ctx.sessions.get(id) || !state().archivedSessionIds.includes(id) ||
            actionFor(lastActivity(handle.header, events), true, Date.now(), config) !== 'delete') continue;
        signal.throwIfAborted();
        if (!latest || latest.header.id !== id) throw new Error('Session identity changed');
        await removeLogGenerations(latest.location);
        for (const workspace of ctx.workspaceRegistry.list()) {
          if (workspace.sessionIds.includes(id)) await workspace.detachSession(id);
        }
        await ctx.workspaceRegistry.unarchiveSession(id);
        report.deleted.push(id);
      } finally { await handle.close(); }
    } catch (error) { report.errors.push({id, error: String(error)}); }
  }
  return report;
}
