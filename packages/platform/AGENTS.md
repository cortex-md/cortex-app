# @cortex/platform

## Platform Contracts

- Keep interfaces free of React, DOM, Electron, and adapter imports.
- `Notifications.schedule(scope, requests)` replaces the whole scheduled queue for a scope (the vault
  path) with absolute `fireAt` timestamps; `onActivation` reports clicks and action buttons with the
  request payload, and `openSystemSettings` opens the OS notification preferences. These methods are
  optional so adapters without scheduling (mobile today) keep compiling; check
  `getCapabilities().schedule` or the `notifications:schedule` capability.
- `.cortex/inbox.md` (`VAULT_FILES.taskInbox`) is in `ALWAYS_SYNCED_CORTEX_FILES`; the task index
  (`VAULT_FILES.taskIndex`) is derived and never synced.
- Window lifecycle capabilities belong in `NativeWindow` and should be implemented by adapters such
  as `apps/desktop/src/platform/electron-platform.ts`; desktop React code should depend on this package instead of calling IPC directly.
- Settings is an in-app modal owned by desktop React state. Do not add settings routing/window
  options to `NativeWindow`; Marketplace opening remains a desktop workspace concern.
- Desktop update checks and installation belong in the `AppUpdates` contract. Keep it
  platform-neutral: expose status, metadata, progress events, install, and changelog reads without
  importing Electron updater APIs or React types.
- Local file asset URL resolution belongs on `App.resolveFileAssetUrl(...)` so React features do not
  import Electron asset helpers directly.
- Hot note reads should use `FileSystem.readFileSnapshot(...)` when callers need content, hash, and
  filesystem metadata together. Keep this contract platform-neutral so desktop and future mobile
  adapters can provide the same cache-friendly path.
- Fresh note creation should use `FileSystem.writeFileSnapshot(...)` when the adapter provides it so
  content, hash, and filesystem metadata come back from the same native write. Shared code must keep
  a `writeFile` plus post-write fingerprint fallback for adapters that do not implement it yet.
- Cortex Cloud subscription status belongs on the `Subscription` contract. The desktop app must not
  create payment checkouts; billing CTAs should open the configured web billing URL. Sync access
  denial events distinguish `kind: "subscription"` from `kind: "vault"` so shared stores can
  preserve links and queued work for billing issues while still unlinking true vault-access denials.
- `Auth`, `Account`, `Devices`, `Members`, `Subscription`, and `RemoteVault` (HTTP only) are
  implemented once by `@cortex/sync-api` `createServerApiServices`; adapters only wire it.
  `Account` covers server capabilities (`getCapabilities`), profile, email/password changes, avatar
  and the one-call account overview. `Members.getVaultOverview` returns members, guest grants,
  invites, member devices and presence in one request; `RemoteVault.updateSettings` edits tenant
  settings (icon, allowed email domains, guests, public links, quota).
- `Shares` publishes E2E public note links. Adapters that hold the vault key (desktop main) wrap a
  random link key with the VEK, encrypt the `SharedNoteBundle`, and return `link` with the key in
  the `#k=` fragment; `open(shareId, key)` fetches and decrypts a link. Mobile rejects until its
  sync engine exists. `.cortex/sync-config.json`
  belongs to `@cortex/core` (`sync/syncConfig.ts`), and vault config paths come from
  `getVaultFilePath`/`VAULT_CONFIG_DIR` in `@cortex/platform/utils` (no `Storage.getVaultConfigDir`).
- Runtime desktop deep-link callbacks belong on `App.onDeepLinkOpen(...)`. Keep this contract
  platform-neutral and use it only as an app-open signal; subscription state must still be validated
  through `Subscription.getStatus(...)`.
- Document import/export helpers should depend on platform contracts for batch file picking,
  optional binary reads, optional native PDF text extraction, and optional native PDF export bridges
  instead of importing desktop APIs.
- `NativePlatform` includes desktop and mobile values: `macos`, `windows`, `linux`, `ios`,
  `android`, and `web`. Shared stores must not assume only desktop platforms exist.
- `VaultMetadata.displayPath` and `VaultRegistryEntry.displayPath` are optional presentation fields.
  Adapters may use them to show a user-facing provider path while keeping `path` stable for shared
  core logic.
- Desktop adapters expose stable logical paths with `/` separators, including on Windows. This
  includes sync event paths, conflict paths, deleted-file paths, vault paths, file entries, dialogs,
  and watcher events. Shared stores and React features should compare and compose `path` values
  using that normalized form and use `displayPath` only when showing the native provider path to
  users.
- Expo mobile adapters should implement the full `Platform` object from the start, even when a
  capability is not ready. Unsupported Phase 0 methods should reject clearly or return typed
  unsupported states such as notification/app-update unsupported results; they must not silently
  report successful vault, sync, keychain, or remote operations.
- Mobile adapters may use Expo APIs for app storage, appearance, deep links, external URLs, device
  metadata, and native directory picking. If a mobile adapter maps logical vault paths to provider
  URIs, the mapping belongs in the app adapter, not in shared platform interfaces or core stores.
  They must not import React UI code, `@cortex/ui`, Electron IPC, Node filesystem modules, or
  desktop-only assumptions into this package.
- `@cortex/platform/utils` is the single home for pure path helpers (separator-safe
  `toVaultRelativePath`/`isPathOrDescendant`, `getParentPath`, `getBaseName`, `getNoteTitle`,
  `splitExtension`, `getRelativePath`, …), `.cortex` layout constants (`VAULT_CONFIG_DIR`,
  `VAULT_FILES`), file fingerprints, and `mapWithConcurrency`. Packages below `@cortex/core` import it
  directly; apps use the `@cortex/core` re-exports. `normalizePath` converts `\` and collapses
  repeated slashes while keeping URI schemes (`file://`) and UNC (`//host`) prefixes.
- Adapters implement only OS primitives; the rules they apply live here as pure functions and are
  called from the Electron main process and the Expo adapter (IO never moves out of main):
  - `@cortex/platform/hash`: `hashBytes` (BLAKE3) is the only content hash for desktop, mobile, and
    sync. Snapshot hashes come from `snapshotFromContent(content, metadata)`.
  - `@cortex/platform/vault`: `toFileEntry`/`toFileMetadata`/`compareFileEntries`,
    `isHiddenVaultPath` (dot segments hidden except `.cortex/schema/`; `.git`, `node_modules`, OS
    junk files, `sync.db*`, and the search index always ignored), `isCaseOnlyRename`,
    `archiveEntrySegments`, vault identity (`readOrCreateVaultId` creates an id only when the file
    is not found; `resolveVaultName` reads `.cortex/vault-metadata.json` and falls back to the
    folder name; `serializeVaultMetadata`), registry ops (`parseVaultRegistry`,
    `upsertRegistryEntry`, `removeRegistryEntry`, `sortRecentVaults`; `lastOpened` is milliseconds,
    old second values are upgraded on parse), and `getOrCreateDeviceId` (UUID persisted under
    `DEVICE_ID_KEY` in the adapter keychain).
  - `@cortex/platform/sync-rules`: the single sync ignore policy and default sync preferences used
    by the sync engine and re-exported by `@cortex/core`. `.cortex/schema/properties.json`,
    `.cortex/inbox.md`, and every `.cortex/comments/**/*.json` sidecar always sync.
- This package is portable: `check:boundaries` rejects `node:`, React, Electron, Expo/React Native
  imports, and DOM globals here.
- `Platform.clipboard` (`writeText`/`readText`) is the only clipboard access for shared and desktop UI
  code. Desktop implements it with `navigator.clipboard`; mobile uses `expo-clipboard`.

- `Notifications.send` accepts `activationScope` (the vault path) and `reply: { placeholder }`.
  Adapters that support it report `getCapabilities().reply`; activations carry the typed text in
  `NotificationActivation.reply` with `actionId: "reply"`, and a click arrives with `actionId: null`.
