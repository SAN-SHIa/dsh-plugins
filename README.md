# DSH Plugins

Three independently installable plugins for **DeepSeek Harness (DSH)**, maintained by SAN-SHIa. MIT licensed. This repository does not contain DSH itself, a theme bundle, user credentials, or session data.

## Plugins

| Package | Features | Scope |
| --- | --- | --- |
| [`dsh-sanshi-ui-enhancements`](packages/ui-enhancements/README.md) | PingFang SC sidebar titles; Command + 1/2/3 session selection; native sidebar glass; local file path tooltips; sidebar-first close; Command + Option + S for Side Chat | DSH Web UI; macOS Desktop for default shortcuts/glass |
| [`dsh-sanshi-deepseek-search`](packages/deepseek-search/README.md) | DeepSeek web search and page extraction as native model tools, without an MCP process | DSH host; your own DeepSeek API credential and network access required |
| [`dsh-session-auto-name`](packages/session-auto-name/README.md) | Update session titles after each conversation turn with a date and current topic | DSH host; uses the session model and may incur additional API charges |

## Install

**Download a plugin's `.tgz` archive from this repository's GitHub Releases**, then install it through DSH's plugin manager (local package installation) or the CLI:

```sh
# Replace the example path with the actual downloaded archive.
dsh plugin --profile desktop add /absolute/path/to/dsh-sanshi-ui-enhancements-1.0.0.tgz
# Or install only search:
dsh plugin --profile desktop add /absolute/path/to/dsh-sanshi-deepseek-search-1.0.0.tgz
# Or install only automatic session naming:
dsh plugin --profile desktop add /absolute/path/to/dsh-session-auto-name-1.0.0.tgz
```

Each archive is an independent DSH bundle; installing one does not enable the others. The repository root is a development workspace, **not an installable DSH bundle**. Do not use `dsh plugin add github:OWNER/dsh-plugins` for this monorepo root. The package names above are archive identities, not a claim that they have been published to npm.

To build archives from source:

```sh
npm ci --ignore-scripts
npm run check
npm run pack:plugins
# Archives are written to dist/.
```

Restart DSH Desktop once after installing UI enhancements. For search, configure `DEEPSEEK_SEARCH_API_KEY` in DSH's credential store or launch environment before enabling the plugin. Merely placing a key in a project `.env` file does not load it.

## Compatibility and limitations

- Target host inspected during development: **DSH `0.2.2-rc.1`**. No broad version-compatibility claim is made.
- UI CSS selectors and the close-command adapter are version-sensitive. Other releases, themes, operating systems, and fresh desktop installs still require manual testing.
- Default shortcuts and native sidebar glass target macOS Desktop. The PingFang SC font is referenced by name; no Apple font files are distributed, and system sans-serif fallbacks apply.
- Side Chat requires a compatible Better Sidebar tab. Other UI features remain independently scoped if that service is missing.
- The UI package installs the official `@deepseek-ai/schemastery` dependency; no machine-specific dependency symlink is required.
- Search sends queries and target URLs to DeepSeek's API and may incur charges. API availability depends on the user's account/access. Unit tests mock network calls and do not prove paid-service availability.
- This is an independent community project, not affiliated with DeepSeek.

## Settings and removal

Settings → Plugins exposes each bundle's enable/disable control. UI enhancements has five independent feature settings. Search unregisters its tools and cancels active requests when disabled.

Remove a package through DSH's plugin manager, or:

```sh
dsh plugin --profile desktop remove dsh-sanshi-ui-enhancements
dsh plugin --profile desktop remove dsh-sanshi-deepseek-search
dsh plugin --profile desktop remove dsh-session-auto-name
```

**Existing local installations:** remove/disable the former `@local/ui-enhancements` and `@local/sanshi-deepseek-search` bundles before installing these public editions. They intentionally preserve entry/command/tool IDs and are replacements, not plugins to run side by side. This repository preparation does not change an existing installation.

## Development

Node.js 22 or newer is required. Sources are under `packages/*/src/`; the UI build script generates its checked-in client entry without a third-party bundler. Run `npm run check` before committing. CI checks Node.js 22/24, tests, deterministic client output, and archive creation. Pushing a `v*` tag runs the release workflow and uploads all three archives; releases are not automatically created during local preparation.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for validation and [SECURITY.md](SECURITY.md) for privacy boundaries. The license is [MIT](LICENSE).
