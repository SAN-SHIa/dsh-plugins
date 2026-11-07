# Security and privacy

- Never commit `.env`, API keys, DSH credential/profile files, session logs, local dependency directories, or generated archives. The examples contain placeholders only.
- Search sends user-supplied queries/URLs and optional localization IPs to DeepSeek's fixed API host. It can incur provider charges. Fetched content is untrusted data, not instructions.
- Search can reuse an existing DSH `DEEPSEEK_API_KEY` credential. Import from Codex configuration is explicitly opt-in and disabled in the public bundle's defaults.
- The UI plugin registers shortcuts, injects styles/overlays, and adapts the close-page command. It does not add telemetry, network calls, polling, or a background process. File path tooltips display local paths on screen, which can be visible in screenshots/screensharing.
- Compatibility is currently limited to the inspected DSH build; stop using the relevant feature if upstream APIs change.

For a suspected vulnerability, do not include keys, full personal paths, or private session content in a public issue. Once the GitHub repository is published, use its private vulnerability reporting feature if enabled; otherwise contact the maintainer before sending sensitive details. For ordinary bugs, provide a redacted reproduction, DSH version, OS, and the specific enabled feature.

Automated secret-pattern checks and unit tests are not a full security audit or a guarantee of live service access.
