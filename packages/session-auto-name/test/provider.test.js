import assert from 'node:assert/strict';
import {test} from 'node:test';
import {apply, inject} from '../src/index.js';

function harness() {
  const listeners = new Map();
  const cleanups = [];
  const ctx = {
    on(name, listener) {listeners.set(name, listener);},
    effect(factory) {const dispose = factory(); cleanups.push(dispose); return dispose;},
    sessionTitle: {
      register(provider) {ctx.provider = provider; return () => {ctx.provider = undefined;};},
    },
    llm: {async prepareCall(route) {
      return {config: route, async *stream() {
        yield {type: 'text-delta', text: '会话自动命名'};
        yield {type: 'finish', reason: {kind: 'stop'}};
      }};
    }},
    emit(name, ...args) {listeners.get(name)?.(...args);},
    dispose() {cleanups.reverse().forEach(dispose => dispose());},
  };
  return ctx;
}
const config = {timeZone: 'Asia/Shanghai', maxInputCharacters: 6000, maxTopicCharacters: 32, timeoutMs: 30000};

test('provider wiring updates two successive turns and releases registration', async () => {
  const ctx = harness();
  apply(ctx, config);
  assert.deepEqual(inject, ['sessionTitle', 'llm']);
  assert.equal(ctx.provider.automatic, 'all-prompts');
  const session = {header: {}, id: 'fixture', seq: 10, eventAt: () => ({type: 'step/start'})};
  const request = {session, route: {provider: 'test', model: 'test'}, signal: new AbortController().signal};
  for (const day of [7, 8]) {
    const result = ctx.provider.generate({...request, messages: [{seq: day, text: '更新会话标题'}]});
    ctx.emit('session/event', session, {type: 'turn/end', time: Date.parse(`2026-11-0${day}T10:00:00Z`)});
    assert.deepEqual(await result, {
      title: `[Nov${day}] 会话自动命名`, messageSeqs: [day], model: request.route,
    });
  }
  ctx.dispose();
  assert.equal(ctx.provider, undefined);
});

test('unload stops pending title work and subagents never call the model', async () => {
  const ctx = harness();
  apply(ctx, config);
  const request = {session: {header: {}, seq: 10, eventAt: () => undefined}, signal: new AbortController().signal};
  const stopped = assert.rejects(ctx.provider.generate(request), /disabled/);
  ctx.dispose();
  await stopped;
  const second = harness();
  apply(second, config);
  await assert.rejects(second.provider.generate({...request, session: {header: {origin: 'subagent'}}}), /excluded/);
  second.dispose();
});
