# @cortex/ipc

## Desktop Windowing

- Keep Tauri window commands inside this package and expose them through `@cortex/platform`.
- Native window visibility operations may group independent show/unminimize calls, but focus should
  happen after the window is visible.
- Preserve route/event emission before focusing a reused settings window.
- Keep settings-window route parameters focused on settings sections and vault context; Marketplace
  opens as a workspace view from desktop code.
- App lifecycle operations such as restart belong on the native window bridge; React code should call
  the platform interface instead of invoking Tauri commands directly.
- App update operations belong on the `AppUpdates` bridge. Wrap Cortex-owned Tauri commands from
  `apps/desktop/src-tauri/src/commands/app_update.rs`; do not import `@tauri-apps/plugin-updater`
  in React or IPC TypeScript.
- File asset URL conversion is implemented by the `App` bridge with Tauri APIs; desktop React
  features should call `getPlatform().app.resolveFileAssetUrl(...)`.
- App data paths must come from Tauri path APIs through the platform storage bridge. Do not derive
  them from `process.env.HOME` or shell-style fallbacks inside the webview.
- Paths returned from Tauri commands, dialogs, watcher events, and sync events/results must be
  normalized to forward slashes before crossing into `@cortex/platform`. When a native path differs
  from the normalized path and the platform type supports `displayPath`, preserve the native value
  there for presentation only.
- Implement `FileSystem.readFileSnapshot(...)` as one native command when content, hash, and
  metadata are needed together. Do not make hot note-open paths pay three IPC round trips from
  React.
- Implement `FileSystem.writeFileSnapshot(...)` as one native command when a caller needs to write
  content and immediately seed NoteCache with hash and metadata. The command must not fail after a
  successful filesystem write just because post-write metadata fallback was needed.
- Subscription status bridges through the Cortex-owned Tauri command in `commands/subscription.rs`.
  React and core code should call `getPlatform().subscription`, billing CTAs should open the web
  billing URL, and sync `402` responses should surface as subscription denials instead of generic
  sync errors.
- Deep link events are exposed through `App.onDeepLinkOpen(...)` with Tauri's deep-link plugin.
  Desktop React features should call the platform bridge and must not import the plugin directly.
