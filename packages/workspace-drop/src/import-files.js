import {open, realpath, stat, link, unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export function safeName(name) {
  if (typeof name !== 'string' || !name || name === '.' || name === '..' || /[\\/\x00-\x1f\x7f]/u.test(name) || Buffer.byteLength(name) > 200) {
    throw new Error('Invalid filename: use a single filename of at most 200 UTF-8 bytes.');
  }
  return name;
}

export function numberedName(name, index) {
  if (index === 0) return name;
  const extension = path.extname(name);
  return `${name.slice(0, name.length - extension.length)} (${index})${extension}`;
}

// Stage privately, then publish with an exclusive hard link: readers see only
// complete bytes, and existing files/symlinks are never replaced, even in races.
export async function publishFile(root, name, chunks, signal, expectedDirectory) {
  safeName(name);
  const directory = await realpath(root);
  if (expectedDirectory !== undefined && directory !== expectedDirectory) throw new Error('Workspace changed before import.');
  if (!(await stat(directory)).isDirectory()) throw new Error('Workspace is not a directory.');
  const temporary = path.join(directory, `.dsh-import-${randomUUID()}.tmp`);
  const handle = await open(temporary, 'wx', 0o600);
  let bytes = 0;
  try {
    for await (const chunk of chunks) {
      signal?.throwIfAborted();
      if (!(chunk instanceof Uint8Array)) throw new TypeError('Invalid attachment bytes.');
      let offset = 0;
      while (offset < chunk.byteLength) {
        const written = await handle.write(chunk, offset, chunk.byteLength - offset);
        if (written.bytesWritten === 0) throw new Error('Could not write imported file.');
        offset += written.bytesWritten;
      }
      bytes += chunk.byteLength;
    }
    await handle.sync();
    await handle.close();
    for (let index = 0; index < 10000; index++) {
      signal?.throwIfAborted();
      if (await realpath(root) !== directory) throw new Error('Workspace changed during import. Retry in the intended workspace.');
      const destination = path.join(directory, numberedName(name, index));
      try {
        await link(temporary, destination);
        return {path: destination, name: path.basename(destination), bytes};
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    }
    throw new Error('Too many files with the same name.');
  } finally {
    await handle.close().catch(() => {});
    // The path is generated here under the verified workspace, never supplied by a caller.
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

export async function importReceipts(ctx, agent, request, signal) {
  if (!agent) throw new Error('A receiving session is required.');
  if (!request || !Array.isArray(request.receiptIds) || request.receiptIds.length < 1 || request.receiptIds.length > 100 || request.receiptIds.some(id => typeof id !== 'string')) {
    throw new Error('Provide between 1 and 100 upload receipt IDs.');
  }
  if (new Set(request.receiptIds).size !== request.receiptIds.length) throw new Error('Duplicate upload receipts.');
  const services = agent.ctx;
  const workingDirectory = services.get('workingDirectory') ?? ctx.workingDirectory;
  const fs = services.get('fs') ?? ctx.fs;
  const policy = (services.get('sandboxPolicy') ?? ctx.sandboxPolicy).resolve({session: agent.session});
  if (policy.mode === 'read-only') throw new Error('Workspace is read-only.');
  const root = workingDirectory.get(agent.session);
  if (request.workspace !== undefined && request.workspace !== root) throw new Error('Workspace changed after the drop. Drop the files again.');
  // Binary writes are not exposed by the composed FS API. Only accept a backend
  // that explicitly identifies this workspace as the same host-local directory.
  if (fs.processPathFromHostPath(root) !== root) throw new Error('Only local workspaces support file-drop import.');
  const target = await fs.resolve(root, {signal});
  const boundary = await fs.resolve(policy.workspaceRoot, {signal});
  const authorizedDirectory = await realpath(root);
  if (fs.processPath(target) !== authorizedDirectory || !fs.contains(boundary, target)) throw new Error('Workspace is outside the writable boundary.');
  const attachments = request.receiptIds.map(id => {
    const staged = ctx.fileUploads.resolve(agent, id);
    if (!staged || staged.type !== 'file') throw new Error('Unknown or foreign file upload receipt.');
    safeName(staged.attachment.name);
    return staged.attachment;
  });
  const files = [];
  const failures = [];
  for (const ref of attachments) {
    signal?.throwIfAborted();
    try {
      const result = await publishFile(root, ref.name, ctx.attachments.readFileStream(ref, signal), signal, authorizedDirectory);
      files.push(result);
    } catch (error) {
      failures.push({name: ref.name, error: error.message});
    }
  }
  return {workspace: root, files, failures};
}
