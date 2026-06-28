# AGENTS.md - @cortex/commands

`@cortex/commands` is the platform-agnostic command registry for Cortex. App commands,
plugin commands, command palette entries, hotkey-backed actions, and Vim command-line entries
must all originate here.

## Responsibilities

- Own `CommandRegistry`, `CommandEntry`, command execution context types, and Vim-safe command
  name helpers.
- Cache command snapshots, Vim choices, and Vim-name lookups inside `CommandRegistry`; consumers
  should read snapshots instead of rebuilding derived lists on every render or key event.
- Stay free of React, Tauri, DOM, CodeMirror, and platform imports so mobile can reuse the same
  registry.
- Store command metadata only. Platform-specific execution details should be injected by the app
  command registration layer.
- Keep plugin and app commands disposable; removed commands must disappear from command lists and
  Vim choices.

## Command Shape

- Use stable IDs such as `file.new`, `editor.find`, or `plugin-id:command-id`.
- Put user-facing names in `label`, grouping in `category`, and optional direct Vim names in
  `aliases`.
- Put configurable keyboard shortcuts in `hotkey`. Use `scope: "global"` for app-level shortcuts,
  `scope: "editor"` for CodeMirror-owned shortcuts, and `scope: "file-explorer"` for shortcuts
  that are interpreted only while the desktop file tree has focus.
- Use `execute(context)` for all dispatch paths. Callers should pass `palette`, `hotkey`, `vim`,
  `slash`, `menu`, `api`, or `test` as the source.
- `CommandRegistry.execute(...)` preserves the boolean dispatch contract and reports sync/async
  command failures internally. Do not let command promise rejections escape as unhandled rejections.
- Use `context.payload` when menus or context actions need an explicit target. Do not add command
  variants solely to smuggle local UI state.

## Vim Names

- Vim command names are derived from aliases, labels, and IDs.
- Normalize to lowercase word names with underscores; dots and hyphens become underscores.
- Avoid registering direct aliases that collide with native Vim commands. Primary ID-derived names
  must remain available, with a stable hash suffix if needed.
