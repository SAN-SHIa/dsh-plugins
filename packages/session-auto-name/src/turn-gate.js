/** Wait for a durable turn boundary without polling or delaying the main agent. */
export function createTurnGate(ctx) {
  const waiting = new Map();
  const finish = (session, error, time) => {
    for (const item of waiting.get(session) ?? []) {
      if (error) item.reject(error); else item.resolve(time);
    }
    waiting.delete(session);
  };
  ctx.on('session/event', (session, event) => {
    if (event.type === 'turn/end') finish(session, undefined, event.time);
  });
  ctx.on('session/disposed', session => finish(session, new Error('Session disposed')));
  ctx.effect(() => () => {
    for (const session of waiting.keys()) finish(session, new Error('Automatic session naming disabled'));
  });
  return function waitForTurnEnd(session, signal) {
    signal.throwIfAborted();
    // Read only the tail: the event itself is already durable when listeners run.
    const latest = session.eventAt(session.seq - 1);
    if (latest?.type === 'turn/end') return Promise.resolve(latest.time);
    return new Promise((resolve, reject) => {
      const items = waiting.get(session) ?? new Set();
      const cleanup = () => {
        items.delete(item);
        if (!items.size) waiting.delete(session);
        signal.removeEventListener('abort', abort);
      };
      const item = {
        resolve(time) { cleanup(); resolve(time); },
        reject(error) { cleanup(); reject(error); },
      };
      const abort = () => item.reject(signal.reason ?? new Error('Aborted'));
      items.add(item);
      waiting.set(session, items);
      signal.addEventListener('abort', abort, {once: true});
      if (signal.aborted) abort();
    });
  };
}
