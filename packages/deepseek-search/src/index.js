import { prepareCredential } from './credentials.js';
import { createTools } from './tools.js';

export const inject = ['tools', 'credentials'];

export async function apply(ctx, config = {}) {
  const credentialRef = await prepareCredential(ctx.credentials, config);
  const lifetime = new AbortController();
  ctx.effect(() => () => lifetime.abort(new Error('DeepSeek search plugin disabled.')));
  for (const definition of createTools({ credentials: ctx.credentials, credentialRef })) {
    const execute = definition.execute;
    ctx.effect(() => ctx.tools.register({
      ...definition,
      async execute(args, exec) {
        const signal = AbortSignal.any([exec.signal, lifetime.signal, AbortSignal.timeout(60000)]);
        return execute(args, { ...exec, signal });
      },
    }));
  }
}
