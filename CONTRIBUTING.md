# Contributing

Use Node.js 22 or newer. Keep package code under `packages/<plugin>/src/`; avoid machine-specific paths and credentials.

```sh
npm ci --ignore-scripts
npm run check
npm run pack:plugins
```

Before a release:

- Verify the checked-in UI client artifact is unchanged after rebuilding.
- Inspect both archives; each should contain only its own package files and MIT license, never node_modules, secrets, profiles, or logs.
- Install the actual archives in an isolated DSH profile and verify activation, independent settings, persistence after restart, and uninstall cleanup. Do not install a public replacement alongside a local predecessor using the same IDs.
- On macOS Desktop, manually test Command + 1/2/3, Command + Option + S, close priority, tooltips, and native glass. Test the other features without Better Sidebar as well.
- Search integration testing uses the tester's own credential and may cost money; it must be explicitly requested. Unit tests do not make network calls.
- State exactly which DSH/OS versions were tested. A skipped optional protocol integration is not a passing integration test.

Tag-based releases upload two independent `.tgz` assets; do not publish the monorepo root as a DSH plugin. Contributions are provided under the repository's MIT license. Preserve third-party notices when adding external code.
