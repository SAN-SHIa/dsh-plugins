import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Bounded migration of only the known MCP credential; never copy the source config.
export function extractSearchCredential(text) {
  const section = text.match(/^\[mcp_servers\.deepseek-search\.env\]\s*\r?\n([\s\S]*?)(?=^\[|(?![\s\S]))/m)?.[1];
  const raw = section?.match(/^\s*DEEPSEEK_API_KEY\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')\s*(?:#.*)?$/m)?.[1];
  if (!raw) return undefined;
  try {
    return (raw.startsWith('"') ? JSON.parse(raw) : raw.slice(1, -1)).trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function prepareCredential(credentials, config) {
  const ref = config.credentialRef ?? 'DEEPSEEK_SEARCH_API_KEY';
  if ((await credentials.describe(ref)).configured) return ref;
  const legacy = await credentials.resolve('DEEPSEEK_API_KEY');
  if (legacy?.value) {
    await credentials.set(ref, legacy.value);
    return ref;
  }
  if (config.importCodexCredential === true) {
    let source;
    try {
      source = await readFile(join(homedir(), '.codex', 'config.toml'), 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error('Cannot read the existing Codex MCP credential configuration.');
    }
    const key = source && extractSearchCredential(source);
    if (key) {
      await credentials.set(ref, key);
      return ref;
    }
  }
  throw new Error(`Configure ${ref} in the DSH credential store or environment before enabling DeepSeek search.`);
}
