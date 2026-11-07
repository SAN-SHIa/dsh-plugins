const BASE = 'https://api.deepseek.com/v1/tools';
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

async function readJson(response) {
  if (!response.body) throw new Error('DeepSeek returned an empty response.');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('DeepSeek response exceeded the 8 MiB limit. Reduce the result count or disable page content.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('DeepSeek returned invalid JSON.');
  }
}

export async function callApi(path, body, { credentials, credentialRef, signal, fetchImpl = fetch }) {
  const credential = await credentials.resolve(credentialRef);
  if (!credential?.value) throw new Error(`Missing ${credentialRef}.`);
  const response = await fetchImpl(`${BASE}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${credential.value}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    await response.body?.cancel();
    const advice = response.status === 402 ? 'Check your DeepSeek account balance.'
      : response.status === 429 ? 'Rate limited; retry later.'
      : [401, 403].includes(response.status) ? 'Check your API credential and access.'
      : 'Check the request or retry later.';
    // Never include response bodies or headers, which may contain credentials.
    throw new Error(`DeepSeek API HTTP ${response.status}. ${advice}`);
  }
  return readJson(response);
}

export function searchBody(args) {
  if (typeof args.query !== 'string' || !args.query.trim() || args.query.length > 128) {
    throw new Error('query must contain 1–128 characters.');
  }
  const count = args.count ?? 10;
  if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error('count must be an integer from 1 to 50.');
  const body = { query: args.query, count, need_content: args.need_content ?? false };
  if (typeof body.need_content !== 'boolean') throw new Error('need_content must be a boolean.');
  if (args.ori_question !== undefined) {
    if (typeof args.ori_question !== 'string' || args.ori_question.length > 128) throw new Error('ori_question must contain at most 128 characters.');
    body.ori_question = args.ori_question;
  }
  if (args.localization !== undefined) {
    if (typeof args.localization !== 'string') throw new Error('localization must be an IP address string.');
    body.localization = args.localization;
  }
  return body;
}

export function fetchBody(args) {
  let url;
  try { url = new URL(args.url); } catch { throw new Error('url must be an HTTP/HTTPS URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('url must be HTTP/HTTPS without embedded credentials.');
  return { url: url.href };
}
