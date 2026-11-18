import {importReceipts} from './import-files.js';

export const inject = ['commands', 'tools', 'workingDirectory', 'fs', 'sandboxPolicy', 'fileUploads', 'attachments'];

export function apply(ctx) {
  const service = {importFiles: (agent, request, signal) => importReceipts(ctx, agent, request, signal)};
  ctx.provide('workspaceDrop', service);
  ctx.commands.register({
    name: 'workspace-import-target',
    description: 'Read the current workspace path before importing a dropped batch.',
    handler: ({agent}) => ({kind: 'success', text: (agent.ctx.get('workingDirectory') ?? ctx.workingDirectory).get(agent.session)}),
  });
  ctx.commands.register({
    name: 'workspace-import-files',
    description: 'Copy staged file uploads into the current local workspace without overwriting files.',
    handler: async ({agent, rawInput, signal}) => {
      try {
        return {kind: 'success', text: JSON.stringify(await service.importFiles(agent, JSON.parse(rawInput), signal))};
      } catch (error) {
        return {kind: 'error', text: error.message};
      }
    },
  });
  ctx.tools.register({
    name: 'workspace_import_files',
    description: 'Copy staged uploads belonging to this session into its current local workspace. Keeps original bytes and renames conflicts; returns imported paths and per-file failures.',
    parameters: {
      type: 'object', additionalProperties: false, required: ['receiptIds'],
      properties: {
        receiptIds: {type: 'array', items: {type: 'string'}, minItems: 1, maxItems: 100, description: 'Upload receipt IDs returned by fileUploads for this session.'},
        workspace: {type: 'string', description: 'Expected current workspace absolute path; reject if the session has changed directories.'},
      },
    },
    output: {schema: {type: 'object'}, render: (_args, value) => [{type: 'text', text: JSON.stringify(value)}]},
    execute: (args, exec) => service.importFiles(exec.agent, args, exec.signal),
  });
}
