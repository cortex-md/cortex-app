# apps/mobile

Expo (SDK 57) React Native app that reuses `@cortex/core`, `@cortex/platform`, and the other
shared packages. Read the root `AGENTS.md` first. Mobile is outside the default CI gate; validate
with `bun run check:mobile`, `bun run test:mobile`, and `bun run doctor:mobile` for React changes.

- Read the versioned Expo docs (https://docs.expo.dev/versions/v57.0.0/) before changing Expo APIs.
- The app needs a development build (`expo-dev-client`): native crypto, bookmarks, and PDF text live
  in `modules/cortex-native`. Build with `bun run --cwd apps/mobile ios -- --device` or `android`,
  then `bun run dev:mobile`. Expo Go runs JS fallbacks only and is not the performance reference.
  `ios/` and `android/` are generated and ignored.

## Structure

```
src/app/          Expo Router routes only; each screen re-exports a feature screen
src/bootstrap/    mobileHost (one-time init), pluginHost (plugin UI mirror), marketplace, commands
src/features/     feature modules (workspace WebView, sidebar, files, note, sync, settings, …)
src/components/ui shared native primitives (Symbol, Form, dialogs, NativeMenu, MarkdownBlock)
src/platform/     Expo adapter for @cortex/platform, one `xxxApi` per domain
src/theme/        native color roles derived from @cortex/theme tokens
```

Naming: PascalCase components, camelCase modules, `useX` hooks, no `mobile-` file prefixes.
`initializeMobileHost()` runs once at module scope of `app/_layout.tsx`.

## UI Rules

- Everything interactive is native: SwiftUI (`@expo/ui/swift-ui`) on iOS, Jetpack Compose
  (`@expo/ui/jetpack-compose`) / Material 3 on Android, the universal `@expo/ui` entry where it
  exists. Never hand-draw headers, buttons, dialogs, sheets, segmented controls, or settings rows.
- `@expo/ui/swift-ui*` imports only in `*.ios.tsx`, Compose only in `*.android.tsx`, with a base
  `X.tsx` stub and a shared `xTypes.ts`.
- SwiftUI elements live inside a `Host`; RN content inside SwiftUI/Compose goes in
  `RNHostView matchContents`. One `Host` per screen or control group — never per list row, never a
  `Form` inside a `ScrollView`. Never pass SwiftUI/Compose elements to `ListItem` leading/trailing.
- Icons: `components/ui/Symbol` (SF + Material names); `lucide-react-native` only for plugin icons.
- Static lists and settings use `components/ui/Form`; large collections stay on
  `FlatList`/`SectionList`.
- Item actions are native context menus (iOS `Link.Menu`, Android Compose `DropdownMenu`);
  confirmations use `Alert.alert` or `ConfirmDialog`.
- Every screen has a native title; never show UUIDs, logical `/mobile-vaults/...` paths, or
  provider URIs. Let Expo Router own safe areas (no `SafeAreaView` for route chrome).
- Colors come only from `useMobileColors()`. Do not import `@cortex/ui`, Electron, Node, or DOM APIs
  in native screens.
- Sheets use the native header (`features/navigation/sheetPresentation.ts`); multi-step sheets are
  folder routes with their own `Stack`.

## Startup

- `AppGate` renders startup state from `useMobileRuntime`, which runs core `bootstrapApp()` and
  `openLastVault()`. If no vault opens, render only `OnboardingScreen`; a vault that needs folder
  access again is listed as "Needs access", not an error.
- `useMobileRuntime` starts `startAppRuntime({ persistWorkspace: false, indexing: "lazy" })` and
  calls `flushPendingWrites()` when the app goes to the background.

## Workspace WebView

One persistent `"use dom"` WebView holds the single CodeMirror editor and the plugin host (the
Obsidian model). Native keeps the shell, core stores, and note sessions.

- CodeMirror, editor extensions, plugin modules, stores, and class instances stay inside the
  WebView and never cross the bridge. Native screens may import only the CodeMirror-free
  `@cortex/editor/editor-config` and editor types.
- One channel, one typed protocol (`features/workspace/workspaceProtocol.ts`). The WebView takes no
  data props (Expo DOM resends props on every render): web → native is the single `send` prop,
  native → web is the single imperative `receive`. Requests carry an `id` and get one `reply`.
- Native forwards only `forwardedPlatformMethods` (async, JSON-only) and typed service calls. Every
  `ready` re-hydrates from scratch (a crashed WebView is reloaded by Expo).
- `workspaceState.ts` publishes only changed keys. `workspaceRealm.ts` is web-realm only; never
  import native modules there.
- Commits are debounced (750 ms) and flushed before native calls, document switches, hide, and
  blur; stale `baseRevision` commits are rejected by the note session.
- The WebView loads the editor runtime on connect; code languages load on demand; vault plugins
  load after the first paint. Editor CSS uses theme variables only.
- Markdown format commands and the toolbar layout come from `@cortex/editor/markdown-format-commands`;
  do not keep a mobile-only catalog. Nothing about properties renders inside the WebView.

## Platform Adapter

- `src/platform/expo-platform.ts` only assembles domain objects (`xxxApi satisfies Platform["xxx"]`),
  mirroring desktop `electron/services`. Layering has no cycles:
  `errors/unsupported/nativePlatform/mobile-vault-paths` → `appStorage` → `vaultRoots` →
  `pathResolver` (`routeStoragePath`) → domain files.
- Vaults use logical paths (`/mobile-vaults/<uuid>`); the adapter owns the map to native `file://` or
  Android `content://` URIs. Shared code never treats provider URIs as vault paths, and app-storage
  paths are classified before vault paths.
- Pure rules (paths, hidden files, entry sorting, vault identity, registry, hashing) come from
  `@cortex/platform/{utils,vault,hash}`. Only `MobilePathNotFoundError` lets `readOrCreateVaultFile`
  mint a new id, so transient provider failures never overwrite `.cortex/vault.json`.
- Internal vaults live in `Paths.document/Cortex/Vaults/<name>` (relative path stored); external
  roots keep an iOS security-scoped bookmark or an Android persistable permission.
- Android `content://` roots cannot be watched: refresh on foreground (no polling). Writes emit
  synthetic watch events because iOS watching is not recursive.
- Server calls come from `@cortex/sync-api` `createServerApiServices`; never reimplement requests.
- The sync engine runs in the JS thread behind the same `Platform["sync"]` contract; the sync DB lives
  in app storage, never in the vault. Native crypto outputs must stay byte-identical to desktop.
- Archive extraction never creates symlinks and rejects escaping paths.
- Unimplemented methods reject clearly or return an explicit unsupported state; never fake success.

## Plugins and Marketplace

- `features/plugins/` is the only native renderer of plugin UI and maps
  `@cortex/plugin-host-core` data (`createPluginViewController`, `PluginViewNodes`); never
  re-implement host logic.
- Community bundles never run in Hermes; they run in the WebView with no isolation. Restricted mode
  (`plugins.allowCommunity`) is enforced only by the WebView host; installing never enables a plugin.
- Mobile never injects theme CSS: community themes are parsed for color variables and mapped back to
  tokens.
- Catalog filtering, grouping, and action state come from `@cortex/marketplace` selectors.

## Shared Behavior

- Settings read and write `useSettingsStore` with the desktop schema keys; no mobile-only keys.
- File actions execute the core `file.*` commands and `getFileEntryActions`; names use
  `validateEntryName`; trees use core `createFileTreeViewModelFromTree` / `useFolderEntries`.
- `openNote(path, { reuseActive? })` mirrors desktop `openTab`; `retargetNoteRoutes` follows renames.
- Indexing stays lazy: `useEnsureVaultIndexed()` runs search then `noteMetadataIndex.build` once per
  vault and applies vault index deltas afterwards. Reminders build the task index shortly after open.
- Everything that needs the server is wrapped in `RequireAccount`; local features never require an
  account. The account owns the server choice; linked vaults keep the server they were linked with.
- Task grouping comes from `@cortex/tasks`, database queries from `@cortex/properties/database` —
  never re-group, filter, or sort in screens.
