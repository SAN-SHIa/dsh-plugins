# DSH Plugins

Five release packages for **DeepSeek Harness (DSH)**. MIT licensed. This repository does not contain DSH itself, a theme bundle, user credentials, or session data.

## Plugins

| Package | Features | Scope |
| --- | --- | --- |
| [`dsh-workspace-drop`](packages/workspace-drop/README.md) | Copy files dropped from Finder into the current workspace; preserve originals; automatically rename conflicts | Local DSH workspace; individual files, not folders |
| [`dsh-ui-enhancements`](packages/ui-enhancements/README.md) | 14 px regular system-font sidebar titles; Command + 1/2/3 session selection; native sidebar glass; local file path tooltips; sidebar-first close; Command + Option + S for Side Chat | DSH Web UI; macOS Desktop for default shortcuts/glass |
| [`dsh-deepseek-search`](packages/deepseek-search/README.md) | DeepSeek web search and page extraction as native model tools, without an MCP process | DSH host; your own DeepSeek API credential and network access required |
| [`dsh-session-auto-name`](packages/session-auto-name/README.md) | Update session titles after each conversation turn with a date and current topic | DSH host; uses the session model and may incur additional API charges |
| [`dsh-semantic-highlight`](packages/semantic-highlight/README.md) | Semantic keyword and sentence highlights, optional bold, and a live enable switch | DSH Web GUI; model-marked emphasis, no automatic recoloring of ordinary bold |

The semantic highlight package is available from source until a release containing its archive is published.

The workspace also contains `dsh-session-retention`, which is not included in the release archives.

## Install

**Download a plugin's `.tgz` archive from this repository's GitHub Releases**, then install it through DSH's plugin manager (local package installation) or the CLI:

```sh
# Replace the example path with the actual downloaded archive.
dsh plugin --profile desktop add /absolute/path/to/dsh-ui-enhancements-1.0.0.tgz
# Or install only search:
dsh plugin --profile desktop add /absolute/path/to/dsh-deepseek-search-1.0.0.tgz
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

- Originally inspected against **DSH `0.2.2-rc.1`**; the UI sidebar styles were updated against `0.2.2-rc.3`. No broad version-compatibility claim is made.
- UI CSS selectors and the close-command adapter are version-sensitive. Other releases, themes, operating systems, and fresh desktop installs still require manual testing.
- Default shortcuts and native sidebar glass target macOS Desktop. The sidebar uses installed system fonts and native language fallbacks; no font files are distributed.
- Side Chat requires a compatible Better Sidebar tab. Other UI features remain independently scoped if that service is missing.
- The UI package installs the official `@deepseek-ai/schemastery` dependency; no machine-specific dependency symlink is required.
- Search sends queries and target URLs to DeepSeek's API and may incur charges. API availability depends on the user's account/access. Unit tests mock network calls and do not prove paid-service availability.
- This is an independent community project, not affiliated with DeepSeek.

## Settings and removal

Settings → Plugins exposes each bundle's enable/disable control. UI enhancements has five independent feature settings. Search unregisters its tools and cancels active requests when disabled.

Remove a package through DSH's plugin manager, or:

```sh
dsh plugin --profile desktop remove dsh-ui-enhancements
dsh plugin --profile desktop remove dsh-deepseek-search
dsh plugin --profile desktop remove dsh-session-auto-name
```

**Migrating an existing installation:** Back up plugin settings, then disable and remove the previous edition before installing its replacement. Package names and some registration IDs changed, so settings tied to an old entry may need to be reapplied. Do not enable two editions of the same plugin together: they can register the same commands, tools or providers. Renaming the source packages does not migrate an installed profile.

## Development

Node.js 22 or newer is required. Sources are under `packages/*/src/`; the UI build script generates its checked-in client entry without a third-party bundler. Run `npm run check` before committing. CI checks Node.js 22/24, tests, deterministic client output, and archive creation. Pushing a `v*` tag runs the release workflow and uploads all five archives; releases are not automatically created during local preparation.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for validation and [SECURITY.md](SECURITY.md) for privacy boundaries. The license is [MIT](LICENSE).
