# AGENTS.md

`@cortex/ipc` implements the desktop Electron platform bridge for `@cortex/platform`.

## Ownership

- `electronPlatform` assembled from typed service classes
- `bridge.ts` (`window.cortex.invoke` / `on`) — the only renderer IPC entry
- Path normalization for values returned from main-process commands and events

## Boundaries

- Do not import `@tauri-apps/*`
- Desktop React features must use `getPlatform()` / `@cortex/platform`, not raw invoke helpers
- Keep window, appearance, notifications, deep links, and app updates behind platform interfaces
- Settings opens as an in-app modal; do not spawn a separate BrowserWindow for settings
- File asset URLs use the `cortex-file://` protocol exposed through `App`
- App data paths come from Electron `app.getPath("userData")` via storage bridge helpers

## Sync and updates

- Sync commands and `sync-*` events must keep the same names the renderer already consumes
- App updates go through `AppUpdates` and Electron main `electron-updater` services

## Validation

```bash
bun run typecheck
bun run test:desktop:frontend
```
