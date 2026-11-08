import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createTurnGate} from '../src/turn-gate.js';
import {cleanTopic, datedTitle, generateTopic, selectMessages} from '../src/topic.js';

function context() {
  const listeners = new Map();
  const cleanups = [];
  return {
    on(name, callback) { listeners.set(name, callback); },
    effect(factory) { cleanups.push(factory()); },
    emit(name, ...args) { listeners.get(name)?.(...args); },
    dispose() { cleanups.forEach(cleanup => cleanup()); },
  };
}
const session = latest => ({seq: 10, eventAt: seq => {assert.equal(seq, 9); return latest;}});

test('date prefix follows Shanghai calendar at the UTC day boundary', () => {
  assert.equal(datedTitle('自动命名', Date.parse('2026-11-07T17:00:00Z'), 'Asia/Shanghai'), '[Nov8] 自动命名');
});
test('output cleaning removes extra prefixes, markup, controls, and commentary', () => {
  assert.equal(cleanTopic('\u001b[31m**[Nov7] 自动命名**\nextra'), '自动命名');
  assert.equal(cleanTopic('标题： “模型路由”'), '模型路由');
  assert.equal(cleanTopic('😀😀😀', 2), '😀😀');
});
test('bounded input prioritizes recent substantive messages', () => {
  assert.deepEqual(selectMessages([{seq: 1, text: 'old'}, {seq: 2, text: 'latest'}], 7), [
    {seq: 1, text: 'o'}, {seq: 2, text: 'latest'},
  ]);
  assert.equal(selectMessages(Array.from({length: 20}, (_, seq) => ({seq, text: 'a'})), 100).length, 8);
});
test('turn gate resolves only at the exact session durable boundary', async () => {
  const ctx = context();
  const wait = createTurnGate(ctx);
  const own = session({type: 'step/end'});
  const other = session({type: 'turn/end'});
  const abort = new AbortController();
  let done = false;
  const result = wait(own, abort.signal).then(time => {done = true; return time;});
  ctx.emit('session/event', other, {type: 'turn/end', time: 1});
  await Promise.resolve();
  assert.equal(done, false);
  ctx.emit('session/event', own, {type: 'tool/result'});
  ctx.emit('session/event', own, {type: 'turn/end', time: 42});
  assert.equal(await result, 42);
  ctx.dispose();
});
test('already-closed turns resolve without event polling', async () => {
  const ctx = context();
  assert.equal(await createTurnGate(ctx)(session({type: 'turn/end', time: 7}), new AbortController().signal), 7);
  ctx.dispose();
});
test('supersession, disposal, and plugin unload reject waiting work', async () => {
  for (const kind of ['abort', 'session', 'plugin']) {
    const ctx = context();
    const wait = createTurnGate(ctx);
    const own = session({type: 'turn/start'});
    const abort = new AbortController();
    const result = assert.rejects(wait(own, abort.signal));
    if (kind === 'abort') abort.abort(new Error('Superseded'));
    if (kind === 'session') ctx.emit('session/disposed', own);
    if (kind === 'plugin') ctx.dispose();
    await result;
  }
});
function llm(chunks, inspect = () => {}) {
  return {async prepareCall(route, signal, configure) {
    const controls = configure({}, {reasoning: {efforts: [{id: 'low'}]}});
    assert.equal(controls.reasoningEffort, 'low');
    return {config: {...route, ...controls}, async *stream(options) {
      inspect(options);
      for (const chunk of chunks) yield chunk;
    }};
  }};
}
const route = {provider: 'test', model: 'test'};
const call = (service, signal = new AbortController().signal) => generateTopic(service, route,
  [{seq: 1, text: '做一个插件'}], 'Previous', signal, 'test-session', 32);

test('title request uses current route and receives only bounded human text', async () => {
  const topic = await call(llm([
    {type: 'text-delta', text: '会话'}, {type: 'text-delta', text: '自动命名'},
    {type: 'finish', reason: {kind: 'stop'}},
  ], options => {
    assert.equal(options.provider, route.provider);
    assert.equal(options.purpose, 'session-title');
    assert.equal(options.tools, undefined);
    const data = JSON.parse(options.messages[0].content[0].text);
    assert.equal(data.previousTitle, 'Previous');
    assert.equal(data.messages[0].text, '做一个插件');
  }));
  assert.equal(topic, '会话自动命名');
});
test('incomplete, empty, tool, and failed responses cannot become titles', async () => {
  for (const kind of ['error', 'aborted', 'max-tokens', 'tool-calls']) {
    await assert.rejects(call(llm([{type: 'text-delta', text: 'Partial'}, {type: 'finish', reason: {kind}}])));
  }
  await assert.rejects(call(llm([{type: 'finish', reason: {kind: 'stop'}}])));
  await assert.rejects(call(llm([{type: 'text-delta', text: 'No finish'}])));
});
test('late model output after cancellation cannot be accepted', async () => {
  const abort = new AbortController();
  abort.abort(new Error('Superseded'));
  await assert.rejects(call(llm([{type: 'text-delta', text: 'Old topic'}]), abort.signal), /Superseded/);
});
