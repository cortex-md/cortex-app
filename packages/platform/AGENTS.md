# @cortex/platform

## Platform Contracts

- Keep interfaces free of React, DOM, Tauri, and adapter imports.
- Window lifecycle capabilities belong in `NativeWindow` and should be implemented by adapters such
  as `@cortex/ipc`; desktop React code should depend on this package instead of calling IPC directly.
- Settings window options carry settings route and vault context only. Marketplace opening is a
  desktop workspace concern and should not be added to `OpenSettingsWindowOptions`.
- Desktop update checks and installation belong in the `AppUpdates` contract. Keep it
  platform-neutral: expose status, metadata, progress events, install, and changelog reads without
  importing Tauri updater APIs or React types.
- Local file asset URL resolution belongs on `App.resolveFileAssetUrl(...)` so React features do not
  import Tauri asset helpers directly.
- Hot note reads should use `FileSystem.readFileSnapshot(...)` when callers need content, hash, and
  filesystem metadata together. Keep this contract platform-neutral so desktop and future mobile
  adapters can provide the same cache-friendly path.
- Cortex Cloud subscription status belongs on the `Subscription` contract. The desktop app must not
  create payment checkouts; billing CTAs should open the configured web billing URL. Sync access
  denial events distinguish `kind: "subscription"` from `kind: "vault"` so shared stores can
  preserve links and queued work for billing issues while still unlinking true vault-access denials.
- Runtime desktop deep-link callbacks belong on `App.onDeepLinkOpen(...)`. Keep this contract
  platform-neutral and use it only as an app-open signal; subscription state must still be validated
  through `Subscription.getStatus(...)`.
- `NativePlatform` includes desktop and mobile values: `macos`, `windows`, `linux`, `ios`,
  `android`, and `web`. Shared stores must not assume only desktop platforms exist.
- Expo mobile adapters should implement the full `Platform` object from the start, even when a
  capability is not ready. Unsupported Phase 0 methods should reject clearly or return typed
  unsupported states such as notification/app-update unsupported results; they must not silently
  report successful vault, sync, keychain, or remote operations.
- Mobile adapters may use Expo APIs for app storage, appearance, deep links, external URLs, and
  device metadata. They must not import React UI code, `@cortex/ui`, Tauri IPC, Node filesystem
  modules, or desktop-only assumptions into this package.
