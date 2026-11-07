# DSH UI Enhancements

**Experimental: targets DSH `0.2.2-rc.1`, with macOS Desktop-specific shortcuts and glass.** Package: `dsh-sanshi-ui-enhancements`. MIT licensed.

## Features / 功能

| Setting (default: enabled) | Behavior |
| --- | --- |
| `typographySessions` | Sidebar session/search titles: PingFang SC, 15 px / 22 px. Command + 1/2/3 opens the first three rendered sessions in current order. 正文、项目标题和时间戳不变。 |
| `sidebarGlass` | Reveals native macOS Desktop sidebar vibrancy in wide-screen layout; content and drawers stay opaque. 仅原生 macOS 桌面毛玻璃。 |
| `fileTooltips` | Shows local link target paths after 100 ms of hover; external web links excluded. 本地文件链接路径提示。 |
| `closePriority` | Existing close-page command first closes the right sidebar page or collapses the sidebar, then falls back to its original handler. 优先关闭右侧页面。 |
| `sidechatShortcut` | Command + Option + S opens Side Chat if Better Sidebar provides it. Side Chat 不可用时不影响其他功能。 |

Settings → Plugins → Local UI enhancements exposes five independent switches. Disabling one disposes its own scope, styles/listeners/commands. Command IDs remain compatible with the corrected former local plugins. Dialogs block session/Side Chat switching.

Session numbering includes rendered rows outside the scroll viewport but excludes collapsed/hidden rows; search results follow their displayed order. Clicking through existing row handlers preserves archived-session restrictions. No polling, mutation observer, process, or animation loop is added. Glass may still add compositor overhead.

## Install / 安装

Download `dsh-sanshi-ui-enhancements-1.0.0.tgz` from this repository's Releases, then install through the DSH plugin manager or:

```sh
dsh plugin --profile desktop add /absolute/path/to/dsh-sanshi-ui-enhancements-1.0.0.tgz
```

Restart Desktop once. **Do not enable alongside `@local/ui-enhancements` or the former five local UI plugins**: their command/entry IDs intentionally overlap. Disable/remove the old version before installing this replacement. This public source preparation does not change your current installed local version.

## Development

From the repository root:

```sh
npm ci --ignore-scripts
npm run check
npm run pack:plugins
```

The official scoped Schemastery package is a normal dependency, not a local symlink. React and client services come from DSH's ModuleLoader. Font names reference installed fonts; no Apple font files are distributed.

`src/client.js` orchestrates five modules under `src/features/`, reading persisted settings through `configForms`. `src/host.js` declares the five volatile settings. `scripts/build.js` creates the checked-in `client.js` artifact; edit sources and rebuild, not the generated artifact.

The stylesheet classes, `configForms` interface, and close-command registry adapter are version-sensitive. Automated tests cover selection, settings reconciliation, and cleanup, not a live Electron keyboard/compositor. Manually test supported desktop versions before expanding compatibility claims. Optional native-protocol integration requires `DSH_SHORTCUT_PROTOCOL_URL` pointing to `protocol.js` extracted from the corresponding installed DSH build.
