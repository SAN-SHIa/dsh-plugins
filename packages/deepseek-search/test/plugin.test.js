import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSearchCredential, prepareCredential } from '../src/credentials.js';
import { callApi, fetchBody, searchBody } from '../src/api.js';
import { createTools, formatSearch } from '../src/tools.js';
import { apply } from '../src/index.js';

const fixtureKey = 'test-only-placeholder';
const credentials = { resolve: async () => ({ value: fixtureKey }), describe: async () => ({ configured: true }) };

test('imports only the exact MCP env section and preserves TOML literals', () => {
  assert.equal(extractSearchCredential('[other]\nDEEPSEEK_API_KEY="wrong"\n[mcp_servers.deepseek-search.env]\nDEEPSEEK_API_KEY = "test-only-placeholder"\n[next]\na=1'), fixtureKey);
  assert.equal(extractSearchCredential("[mcp_servers.deepseek-search.env]\nDEEPSEEK_API_KEY='literal'\n"), 'literal');
  assert.equal(extractSearchCredential('[other]\nDEEPSEEK_API_KEY="wrong"'), undefined);
});

test('existing credential is reused without migration', async () => {
  assert.equal(await prepareCredential(credentials, {}), 'DEEPSEEK_SEARCH_API_KEY');
});

test('search validates bounds without silently changing the query', () => {
  assert.deepEqual(searchBody({ query: 'site:example.com test' }), { query: 'site:example.com test', count: 10, need_content: false });
  for (const args of [{ query: '' }, { query: 'x'.repeat(129) }, { query: 'x', count: 51 }, { query: 'x', count: 1.5 }, { query: 'x', need_content: 'yes' }]) assert.throws(() => searchBody(args));
});

test('fetch accepts only HTTP(S) without URL credentials', () => {
  assert.equal(fetchBody({ url: 'https://example.com' }).url, 'https://example.com/');
  for (const url of ['file:///tmp/x', 'ftp://example.com', 'https://user:pass@example.com', 'bad']) assert.throws(() => fetchBody({ url }));
});

test('API uses fixed endpoint, credential and caller cancellation', async () => {
  const signal = new AbortController().signal;
  const result = await callApi('search', { query: 'test' }, { credentials, credentialRef: 'TEST', signal, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/v1/tools/search');
    assert.equal(options.headers.Authorization, `Bearer ${fixtureKey}`);
    assert.equal(options.signal, signal);
    return Response.json({ results: [] });
  } });
  assert.deepEqual(result, { results: [] });
});

test('HTTP errors never echo response bodies or keys', async () => {
  await assert.rejects(callApi('search', {}, { credentials, credentialRef: 'TEST', fetchImpl: async () => new Response(fixtureKey, { status: 401 }) }), error => error.message.includes('401') && !error.message.includes(fixtureKey));
});

test('output retains source URLs and marks truncation', () => {
  assert.match(formatSearch({ results: [{ title: 'Test', url: 'https://example.com', content: 'x'.repeat(4000) }] }), /excerpt truncated/);
  assert.match(formatSearch({ results: [] }), /0 results/);
  assert.throws(() => formatSearch({}));
});

test('both tools render text and fetch bounds output', async () => {
  const tools = createTools({ credentials, credentialRef: 'TEST', fetchImpl: async () => Response.json({ title: 'Test', content: 'x'.repeat(65000) }) });
  const tool = tools.find(item => item.name === 'deepseek_fetch');
  const text = await tool.execute({ url: 'https://example.com' }, { signal: new AbortController().signal });
  assert.match(text, /Truncated/);
  assert.match(text, /https:\/\/example.com/);
  assert.equal(tool.output.render({}, text)[0].text, text);
});

test('plugin unload removes both registrations', async () => {
  const registry = new Map();
  const disposers = [];
  const ctx = { credentials, tools: { register(def) { registry.set(def.name, def); return () => registry.delete(def.name); } }, effect(callback) { const dispose = callback(); disposers.push(dispose); return dispose; } };
  await apply(ctx);
  assert.equal(registry.size, 2);
  for (const dispose of disposers.reverse()) dispose();
  assert.equal(registry.size, 0);
});
