# Architecture Practices

This guide summarizes the day-to-day rules contributors should follow when changing Cortex.

## Package Ownership

- `apps/desktop` owns Tauri desktop composition, desktop feature UI, shell layout, settings windows,
  and native app integration.
- `@cortex/core` owns pure app logic, stores, NoteCache, vault state, sync state, onboarding logic,
  and shared domain behavior.
- `@cortex/platform` defines cross-platform contracts for filesystem, dialogs, windows, storage,
  notifications, and app services.
- `@cortex/ipc` implements the Tauri desktop adapter for platform contracts.
- `@cortex/editor` owns CodeMirror setup, Markdown editing, Live Preview, keymaps, and editor
  runtime loading.
- `@cortex/renderer` owns sanitized rendered Markdown semantics.
- `@cortex/ui` owns shared React primitives only.
- `@cortex.md/api` is the public plugin API. Keep it free of React, DOM, Tauri, CodeMirror, and
  internal implementation packages.

## Platform Boundaries

React desktop code should not call Tauri APIs directly. Use the platform abstraction:

```ts
import { getPlatform } from "@cortex/platform"

const platform = getPlatform()
const files = await platform.vault.scanVault(vaultPath)
```

If a feature needs new native behavior:

1. Add or extend the `@cortex/platform` contract.
2. Implement the desktop adapter in `@cortex/ipc`.
3. Add the Rust command in `apps/desktop/src-tauri`.
4. Call the platform method from desktop or core code.

## React And UI

- Prefer `@cortex/ui` primitives over raw HTML when a primitive exists.
- Keep feature-specific React state close to the desktop feature that owns it.
- Hoist static arrays, options, and pure helpers out of components when they do not need render-local
  data.
- Use `Promise.all` for independent async work.
- Avoid mirroring props into local state for commit-on-blur inputs. Prefer uncontrolled inputs with
  `defaultValue`, a stable `key`, and an `onBlur` commit.
- Use React Doctor for React-facing desktop changes.

## Files, Notes, And Vaults

- Shared stores should work with logical vault paths that use `/` separators.
- UI may show `displayPath` when a platform adapter provides a native presentation path.
- Creating files and folders should treat a successful filesystem write as creation success.
  Hashing, metadata refresh, cache priming, indexing, and UI refresh are post-create work.
- Note title renames should go through `vaultStore.renameFile` so tabs, bookmarks, NoteCache, and
  filesystem state move together.

## Editor And Markdown

- Frontmatter must not enter CodeMirror documents, cursor positions, selections, or coordinate
  models.
- Shared rendered Markdown semantics belong in `@cortex/renderer`.
- Editable Markdown behavior belongs in `@cortex/editor`.
- Desktop CSS owns Reading View, Side-by-Side, and app shell layout. Live Preview projection styles
  belong with the editor package.

## Rust

- Keep Rust changes limited to native OS work, IPC commands, sync internals, filesystem behavior,
  file watching, keychain, protocol handling, menu integration, and window behavior.
- Keep fatal errors scoped. For vault scans, inaccessible roots are fatal; unreadable children should
  be skipped when possible so one locked file does not make the vault appear empty.
- Add Rust tests for command behavior and sync/file edge cases.

## Tests And Documentation

- Add focused tests for new behavior, bug fixes, and cross-package contracts.
- Update docs when setup, commands, public APIs, package ownership, or contribution workflow changes.
- Avoid unrelated refactors in bug-fix pull requests.
