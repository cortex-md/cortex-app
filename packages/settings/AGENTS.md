# @cortex/settings

## Defaults

- App defaults live in `src/defaults.ts`, including system font constants, appearance defaults,
  editor defaults, file defaults, hotkey defaults, and the complete app default snapshot.
- `DEFAULT_ACCENT_COLOR` should match the active built-in theme accent so the desktop appearance
  layer treats the shipped theme color as the no-override state.
- `src/defaults.ts` must stay free of React, DOM, Tauri, platform, Zustand, and schema imports so
  desktop and future React Native code can consume the same values without pulling UI runtime code.
- Zod schemas and `SettingsManager` should consume the shared defaults instead of duplicating
  literals in schema declarations, desktop appearance code, or tests.
- Editor feature flags such as `folding`, `slashCommands`, and `markdownToolbar` belong in the
  shared editor defaults and schema so desktop can compose the UI while future adapters inherit the
  same default behavior.

## Settings Boundaries

- `SettingsManager` owns persistence and platform filesystem access.
- `SettingsManager.set(...)` validates the full candidate settings snapshot before mutating cache,
  notifying listeners, or scheduling persistence. Invalid values must leave memory and disk state
  unchanged.
- The Zustand store is an optional frontend convenience; portable defaults and schema contracts
  must remain usable without importing the store.
- The Zustand store should keep at most one active `SettingsManager` subscription across vault
  loads.
- `useSettingsStore.updateSetting(...)` should refresh its local snapshot from `SettingsManager`
  after every successful write because global settings can bypass the vault subscription path.
- App-wide settings that affect native process/window startup, such as `appearance.nativeWindowEffects`,
  are persisted in the app data settings file, not in a vault's `.cortex/app.json`. Vault settings
  may parse legacy aliases for migration, but must not become the authority for native window effects.
