# AGENTS.md - @cortex/commands

`@cortex/commands` is the platform-agnostic command registry for Cortex. App commands,
plugin commands, command palette entries, hotkey-backed actions, and Vim command-line entries
must all originate here.

## Responsibilities

- Own `CommandRegistry`, `CommandEntry`, command execution context types, and Vim-safe command
  name helpers.
- Cache command snapshots, Vim choices, and Vim-name lookups inside `CommandRegistry`; consumers
  should read snapshots instead of rebuilding derived lists on every render or key event.
- Stay free of React, Electron, DOM, CodeMirror, and platform imports so mobile can reuse the same
  registry.
- Store command metadata only. Platform-specific execution details should be injected by the app
  command registration layer.
- Keep plugin and app commands disposable; removed commands must disappear from command lists and
  Vim choices.
- Register static command sets with `registerCommands([...])` / `registry.registerMany(...)` so
  subscribers are notified once per batch instead of once per command.

## Command Shape

- Use stable IDs such as `file.new`, `editor.find`, or `plugin-id:command-id`.
- Put user-facing names in `label`, grouping in `category`, and optional direct Vim names in
  `aliases`.
- Put configurable keyboard shortcuts in `hotkey`; there is no separate display `shortcut` field. Use `scope: "global"` for app-level shortcuts,
  `scope: "editor"` for CodeMirror-owned shortcuts, and `scope: "file-explorer"` for shortcuts
  that are interpreted only while the desktop file tree has focus.
- Use `execute(context)` for all dispatch paths. Callers should pass `palette`, `hotkey`, `vim`,
  `slash`, `menu`, `api`, or `test` as the source.
- `CommandRegistry.execute(...)` preserves the boolean dispatch contract and reports sync/async
  command failures internally. Do not let command promise rejections escape as unhandled rejections.
- Use `context.payload` when menus or context actions need an explicit target. Do not add command
  variants solely to smuggle local UI state.

## Recent Commands

- `pushRecentCommandId`, `normalizeRecentCommandIds`, and `resolveRecentCommands` are the shared MRU
  rules for command surfaces (cap `RECENT_COMMAND_LIMIT`). Hosts store the id list; resolving
  against the current registry snapshot silently skips commands that were unregistered.

## Vim Names

- Vim command names are derived from aliases, labels, and IDs.
- Normalize to lowercase word names with underscores; dots and hyphens become underscores.
- Avoid registering direct aliases that collide with native Vim commands. Primary ID-derived names
  must remain available, with a stable hash suffix if needed.

## Hotkeys (`@cortex/commands/hotkeys`)

- `@cortex/commands/hotkeys` is a binding and override engine, not a command catalog.
- `HotkeyBinding` derives `id`, `label`, `category`, and scope from `CommandEntry`. Desktop mirrors
  the registry through `bootstrap/commandHotkeyBridge.ts`, which calls `syncCommands(commands)`
  once per registry change. `syncCommands` reuses unchanged binding objects and parsed keys.
- Keep user overrides per vault in `.cortex/hotkeys.json` as `Record<commandId, { keys, enabled? }>`.
  Overrides must survive while commands appear, disappear, or reload.
- Parse hotkey strings when bindings enter the store. `handleKeyEvent(...)` matches pre-parsed
  global bindings and executes them through `commandRegistry.execute(..., { source: "hotkey" })`.
  Editor and file-explorer scoped bindings are interpreted by their focused host surfaces.

- Do not add `DEFAULT_HOTKEYS`, handler maps, or another static shortcut catalog here.
- Do not import React into store/parser modules. React hooks may stay in the hook files only.
