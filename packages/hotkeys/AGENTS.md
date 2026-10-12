# @cortex/hotkeys

## Responsibility

- This package is a binding and override engine, not a command catalog.
- `HotkeyBinding` derives `id`, `label`, `category`, and scope from `CommandEntry`. Desktop mirrors
  the registry through `bootstrap/commandHotkeyBridge.ts`, which calls `syncCommands(commands)`
  once per registry change. `syncCommands` reuses unchanged binding objects and parsed keys.
- Keep user overrides per vault in `.cortex/hotkeys.json` as `Record<commandId, { keys, enabled? }>`.
  Overrides must survive while commands appear, disappear, or reload.
- Parse hotkey strings when bindings enter the store. `handleKeyEvent(...)` matches pre-parsed
  global bindings and executes them through `commandRegistry.execute(..., { source: "hotkey" })`.
  Editor and file-explorer scoped bindings are interpreted by their focused host surfaces.

## Rules

- Do not add `DEFAULT_HOTKEYS`, handler maps, or another static shortcut catalog here.
- Do not import React into store/parser modules. React hooks may stay in the hook files only.
