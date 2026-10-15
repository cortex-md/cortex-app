# @cortex/settings

## Defaults

- App defaults live in `src/defaults.ts`, including system font constants, appearance defaults,
  editor defaults, file defaults, and the complete app default snapshot. Hotkey overrides live in
  `@cortex/commands/hotkeys`, not in app settings.
- `DEFAULT_ACCENT_COLOR` should match the active built-in theme accent so the desktop appearance
  layer treats the shipped theme color as the no-override state.
- `src/defaults.ts` must stay free of React, DOM, Electron, platform, Zustand, and schema imports so
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
- `plugins.allowCommunity` (restricted mode, `DEFAULT_PLUGINS_SETTINGS`, off by default) is also
  app-wide: `SettingsManager` keeps the whole `plugins` section in the app data settings file
  (`isGlobalSetting`) and strips it from the vault snapshot.

- The `tasks` section (`DEFAULT_TASKS_SETTINGS`, `TasksSettingsSchema`) holds task reminder and
  notification preferences: reminders on/off, default reminder offset, the reminder time for tasks
  without a time, daily digest, flat quiet-hours keys, and sound. It is a vault setting stored in
  `.cortex/app.json`, so it syncs only when the "App settings" sync preference is enabled.

## Settings Search

- `SETTINGS_FIELDS` (`settingsFields.ts`) is the catalog of every core settings field: id
  (`<page>.<field>`), page key, section, label, optional description, and search keywords. It is the
  source of the field text; every new settings field gets an entry here and the UI references it by id.
- `searchSettings(items, query)` ranks `SettingsSearchItem`s (pages, fields, plugins, templates) with
  diacritic-insensitive AND matching (label > keyword > path > description) and returns label match
  ranges for highlighting. Apps build the items from the catalog plus their dynamic sources.
- `filterSettingsPages(pages, query)` remains for page-only filtering and shares the same normalization.

- `tasks.mentionsEnabled` (default `true`) gates mention and comment notifications; it shares quiet
  hours and sound with task reminders.

- The `dailyNotes` section (`DEFAULT_DAILY_NOTES_SETTINGS`, `DailyNotesSettingsSchema`) is a vault
  setting: `folder` (vault-relative, empty for the root), `format` (an `@cortex/core/templates` date
  pattern such as `yyyy-MM-dd`, may contain `/`), and `templateId` (empty for the built-in daily
  note).
