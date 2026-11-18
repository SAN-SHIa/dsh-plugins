# Workspace file drop

Copies files dropped from macOS Finder/Desktop into the current local session working directory immediately, without sending a prompt. The source file is not moved. Multiple files, binary files, images (original bytes), Unicode filenames, and empty files are supported. Filename conflicts receive ` (1)`, ` (2)`, etc. before the extension. A frame-wide notice reports exact imported paths and failures.

Install this directory using Harness's plugin manager. Reload the existing Harness window if the new client registration has not loaded. Disable/remove `dsh-workspace-drop` under Settings → Plugins to restore standard attachment drops. The plugin does not modify the app bundle.

## Behavior and limits

- A selected local session with upload and command access is required. No prompt needs to have been sent.
- External file drops are imported instead of entering the attachment draft rail. Existing paste/file-picker attachment behavior is unchanged. Internal `application/x-dsh-file` drags are unchanged.
- Folder drops are rejected explicitly; drop individual files instead.
- Remote filesystem backends and read-only session policies are refused. The Host derives the destination from the receiving session, never from a browser-supplied destination.
- The workspace is captured before upload; a directory change during upload refuses that file rather than importing into the new directory.
- Files use the authenticated streamed upload service. Only exact-session receipts can be imported. No arbitrary source host paths are accepted. Attachment staging is managed by Harness; imports do not delete that storage.
- Complete contents are staged in a private temporary file and published with an exclusive hard link. Existing files, directories, and symlinks are never replaced. The target filesystem must support hard links (normal macOS APFS does).
- Filenames are limited to 200 UTF-8 bytes; path separators and control characters are rejected. Import errors do not silently discard other successful files.
- Disabling/unloading aborts pending browser operations and removes event listeners and UI entries. A file already committed by the Host remains imported.

## Development

`node scripts/build.js` produces the browser entry from `src/client.js`. Run `node --test test/*.test.js` for import and shared tool/command tests. `workspace_import_files` exposes the same Host import operation to agents using upload receipt IDs; `/workspace-import-files` is its UI command adapter. This adds one tool schema to model context and no system-prompt sections.

Icon artwork is original and distributed under MIT. Tested against DSH 0.2.2-rc.1 contracts; physical Finder drag and rendered light/dark appearance still require manual desktop verification.
