# @cortex/hotkeys

## Responsibility

- This package is a binding and override engine, not a command catalog.
- Command metadata and default shortcuts come from `@cortex/commands`. Desktop mirrors command
  hotkeys into this store through `bootstrap/commandHotkeyBridge.ts`.
- Keep user overrides per vault in `.cortex/hotkeys.json` as `Record<commandId, { keys, enabled? }>`.
  Overrides must survive while commands appear, disappear, or reload.
- Parse hotkey strings when bindings enter the store. `handleKeyEvent(...)` should match
  pre-parsed bindings instead of parsing on every keydown.
- Global handlers are registered by command id and dispatch back into `commandRegistry.execute(...)`.
  Editor and file-explorer scoped bindings are interpreted by their focused host surfaces.

## Rules

- Do not add `DEFAULT_HOTKEYS`, `addDynamicBinding`, `dynamicBindingIds`, or another static shortcut
  catalog here.
- Do not import React into store/parser modules. React hooks may stay in the hook files only.
- Do not execute app logic directly from this package. A matched binding calls its registered
  command handler; command execution remains owned by `@cortex/commands`.
