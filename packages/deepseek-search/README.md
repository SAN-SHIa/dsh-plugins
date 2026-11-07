# DSH DeepSeek Search / DeepSeek 搜索

A native DeepSeek Harness plugin exposing `deepseek_web_search` and `deepseek_fetch`, without an MCP child process or third-party runtime dependency. Package: `dsh-sanshi-deepseek-search`. MIT licensed. Target host inspected: DSH `0.2.2-rc.1`.

## Features / 功能

- Web search: titles, source URLs, dates, summaries, optional page excerpts. Default 10 results, range 1–50; query length 1–128 characters.
- Page extraction as Markdown, including source URL and a truncation notice.
- Fixed endpoints: `https://api.deepseek.com/v1/tools/search` and `/fetch`.
- Requests time out after 60 seconds; response limit 8 MiB; rendered output about 60,000 characters.
- Disabling unregisters both tools and cancels active requests. Web content is explicitly marked untrusted source data.

## Install and credentials / 安装与凭据

Download the search `.tgz` from this repository's Releases, then use DSH's plugin manager or:

```sh
dsh plugin --profile desktop add /absolute/path/to/dsh-sanshi-deepseek-search-1.0.0.tgz
```

Configure your **own** `DEEPSEEK_SEARCH_API_KEY` in DSH's credential store or launch environment before enabling. An unconfigured plugin fails activation with a missing-key message. Keys are resolved for each call. `.env.example` is a placeholder only: this plugin does not load your project's `.env` file.

If the dedicated key is missing, the plugin can reuse the existing DSH credential named `DEEPSEEK_API_KEY`, copying its value into the dedicated reference. **The public edition disables Codex credential import by default** (`importCodexCredential: false`). It does not read Codex files unless a user explicitly sets this configuration to `true`. Opt-in migration reads only the known MCP environment section in `~/.codex/config.toml`; it does not modify that source file.

**Do not enable alongside `@local/sanshi-deepseek-search` or another plugin registering these same tool names.** Remove/disable the local version before installing this replacement.

## Privacy, access, and cost / 隐私与费用

Search queries, requested target URLs, and the optional localization IP are sent to DeepSeek. Your API credential is sent only to the fixed DeepSeek API endpoint as a Bearer token. Response bodies and headers are not echoed in API error messages; no key is bundled with this repository.

API calls may incur charges and may require account-specific access; possession of a generic API key does not guarantee that these endpoints are available to every account. Check the provider's current terms and pricing. Automated tests mock API responses and are not a paid-service availability guarantee.

## Development

From the repository root:

```sh
npm ci --ignore-scripts
npm test --workspace=dsh-sanshi-deepseek-search
npm run pack:plugins
```

No API request or credential lookup is needed to run unit tests. The icon is an original SVG. Search content and fetched pages remain third-party content subject to their own rights and terms.
