# Cortex Mobile

## Expo SDK 57

- Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before changing Expo APIs.
- Keep this app native-first: Expo Router nested `Stack` headers, the mobile sidebar/drawer,
  gestures, platform colors, iOS glass/material behavior, and Material/UIKit defaults should own the
  shell.
- `@cortex/core` and `@cortex/properties` are wired for local-first vaults selected through native
  directory picking.
- CodeMirror and editor runtime values (`@cortex/editor` views, extensions, keymaps, commands)
  run only inside the mobile editor DOM boundary. Native screens may import only the pure,
  CodeMirror-free subpaths `@cortex/editor/editor-config` and editor types.

## Structure

Mirrors the desktop renderer layout:

```
src/
  app/                    # Expo Router routes only; screens are thin re-exports of features/*
    _layout.tsx           # initializeMobileHost() + root providers
  bootstrap/              # mobileHost (one-time init), pluginHost (plugin UI mirror facade),
                          # marketplace, appCommands, crypto
  hooks/                  # useMobileRuntime, useSettingsColorScheme, useActiveTheme, useMobileColors
  components/ui/          # Shared primitives: Symbol, Form (NativeForm/FormSection/FormRow/FormToggle),
                          # dialogs, NativeMenu, SegmentedControl, MobileTextField,
                          # MarkdownBlock ("use dom" sanitized Markdown)
  features/               # layout (AppGate), workspace (persistent WebView), sidebar, file-explorer,
                          # vault, notes, editor, onboarding, settings, search, themes (themeSync),
                          # plugins, marketplace
  platform/               # Expo adapter for @cortex/platform (see Platform Adapter)
  theme/colors.ts         # PlatformColor mapping over @cortex/theme tokens
  utils/                  # haptics
```

- Naming: PascalCase components, camelCase modules, `useX` hooks, no redundant `mobile-` file
  prefix. Routes in `app/` only re-export a feature screen.
- `bootstrap/mobileHost.ts` `initializeMobileHost()` runs once at module scope of `app/_layout.tsx`:
  crypto polyfill, `initPlatform(expoPlatform)`, `initializeCoreProperties`, app commands, and
  the marketplace callbacks. Plugins are registered inside the workspace WebView.
- Read native colors through `useMobileColors()` (`{ scheme, colors, iconColors, staticColors }`);
  do not repeat `getMobileColorScheme(useColorScheme())` lookups.
- The sidebar drawer (`features/sidebar/`) owns the drawer, `useMobileSidebar`, and one UI reducer
  (`sidebarUiState.ts`); `features/file-explorer/useFileExplorerActions` and
  `features/vault/useVaultSwitcher` hold the tree and vault-switching handlers over that state.
  Item actions use native context menus (see UI Rules).

## UI Rules

- Everything interactive is native: SwiftUI (`@expo/ui/swift-ui`) on iOS with Liquid Glass, Jetpack
  Compose (`@expo/ui/jetpack-compose`) / Material 3 on Android, the universal `@expo/ui` entry where it
  exists. Do not hand-draw headers, buttons, dialogs, action sheets, segmented controls or settings rows
  in React Native.
- `@expo/ui/swift-ui*` imports only in `*.ios.tsx`; `@expo/ui/jetpack-compose*` only in `*.android.tsx`,
  with a base `X.tsx` stub that returns null and a shared `xTypes.ts`.
- A SwiftUI element always lives inside a `Host`; React Native content inside a SwiftUI/Compose tree
  goes in `RNHostView matchContents`. Never pass SwiftUI/Compose elements as `leading`/`trailing` of
  the universal `ListItem` (it wraps them in `RNHostView`, which crashes on iOS).
- One `Host` per screen or control group. Never a `Host` per row of a `FlatList`/`SectionList`, never a
  `FieldGroup`/`Form` inside a `ScrollView`.
- Icons: only `components/ui/Symbol` (`{ sf, md }` → expo-symbols `SymbolView`), SwiftUI
  `Image systemName` inside SwiftUI trees, and SF names in `Stack.Toolbar`. `lucide-react-native` is
  only used by `PluginIcon` to resolve icons declared by plugins.
- Tab roots use the system large title: `useStackScreenOptions` never sets an iOS header background
  (it hides the large title on iOS 26) and the first child is a scroll view with automatic insets.
- Short static lists and settings pages use `components/ui/Form` (`NativeForm`, `FormSection`,
  `FormRow`, `FormToggle`): iOS SwiftUI `Form`/`Section`, Android a Compose `LazyColumn` with M3
  connected rows. `NativeForm` scrolls by itself and is the screen's root content. Feature folders own
  their platform form controls (pickers, text fields, date pickers) next to their screens and theme
  every row with `useFormTheme()` (iOS) or `formColors.ts` (Android) so rows follow the Cortex theme.
- Large collections (files, search results, tasks, logs, versions) stay on `FlatList`/`SectionList`
  with React Native rows styled like native inset lists.
- Text fields: SwiftUI `TextField`/`SecureField` inside forms on iOS; on Android Compose text fields
  or `MobileTextField`. Do not use the universal `@expo/ui` `TextInput` (Android Expo Go warnings).
- Item actions are native context menus: iOS wraps rows in expo-router `Link` + `Link.Menu`
  (`onPress` prevents navigation and runs the handler; row styles must be plain objects, not
  `({ pressed }) => ...` functions, because `Link.Trigger asChild` spreads them), Android opens a Compose `DropdownMenu`
  (`features/file-explorer/FileExplorerHost.android.tsx`). Confirmations use RN `Alert.alert`
  (native) or `ConfirmDialog`; name prompts use `Alert.prompt` on iOS and `TextPromptDialog` on Android.
- Every screen and sheet has a native title; no subtitles that repeat the title, no duplicated actions,
  no footers that restate rows. Never show UUIDs, logical `/mobile-vaults/...` paths or provider URIs.
- Do not import `@cortex/ui`; desktop/web primitives are not mobile shell components.
- Do not add Electron, IPC, Node, browser DOM, or desktop-only platform imports to native React Native
  screens.
- Do not use `SafeAreaView` for route chrome. Let Expo Router native tabs/stacks and automatic
  content insets own safe areas; scroll screens use `contentInsetAdjustmentBehavior="automatic"`.
- Colors come only from `useMobileColors()` roles derived from Cortex tokens.

## Navigation and Sheets

- `features/navigation/sheetPresentation.ts` presents sheets and modals with the native header
  (`headerShown: true`, `headerTransparent` on iOS for Liquid Glass bars). Screens set `title` through
  `Stack.Screen` and their buttons through `Stack.Toolbar` (iOS) or `headerLeft`/`headerRight` with
  `HeaderIconButton` / `@expo/ui` `Button` (Android). `fitToContents` detents do not support a header.
- Multi-step sheets are folder routes with their own `Stack` (`app/properties/`, `app/add-vault/`,
  `app/import/`, `app/share-template/`, `app/from-template/`); AppGate declares them with
  `headerShown: false` so each step gets a native header and back button.
- `openNote` replaces the current note screen when a note is already on top of the focused tab stack,
  so opening notes from inside a note does not grow the stack.

## App Gate and Onboarding

- `AppGate` renders startup state from `useMobileRuntime`, which runs core `bootstrapApp()`
  and `openLastVault()` (the registry's most recent vault, honoring `autoOpenLastVault`). There is no
  mobile-only startup file.
- If no vault opens during startup, render only `OnboardingScreen`. Do not mount the sidebar,
  stack shell, file list, or workspace chrome before onboarding completes. A last vault that needs
  folder access again is not a startup error: onboarding lists it under Recent vaults as "Needs access".
- Onboarding is native and minimal: Welcome (Create new vault, Open folder, Sign in, Recent vaults),
  Identity (empty name field, color, icon), Sync preferences, then the pending welcome note. Creating
  a vault on mobile turns `editor.showLineNumbers` off.
- "Create new vault" never asks for a folder: the vault is created inside the app container (see
  Platform Adapter). "Open folder" keeps the native picker. Names never come from logical paths.

## Workspace WebView

Mobile follows the Obsidian model: one persistent `"use dom"` WebView for the app's lifetime holds the
single CodeMirror editor and the same local plugin host as desktop. Native keeps the shell, the core
stores, note sessions, and draws plugin UI from a mirror.

- `features/workspace/WorkspaceHost.tsx` mounts `WorkspaceWebView` once in `AppGate` (inside the drawer
  content, before `PluginModalHost`) as an absolute layer. It is laid over the focused note's placeholder
  rectangle and is otherwise hidden (`opacity: 0`, `pointerEvents="none"`). The WebView element sits in a
  memoized frame with constant props, so layout changes never resend DOM props.
- In Expo Go, pass `dom.useExpoDOMWebView = false` and keep `react-native-webview` as a direct
  dependency.
- One channel, one typed protocol (`features/workspace/workspaceProtocol.ts`). Expo DOM resends every
  prop as JSON on each native render, so the WebView takes no data props: web → native is the single
  async `send(message)` prop, native → web is the single `useDOMImperativeHandle` method
  `receive(message)` (fire-and-forget). Requests carry an `id` and are answered by one `reply`
  (`createWorkspaceRequests`/`answerWorkspaceRequest` on both sides).
  - Native → web: `plugin` (`PluginUiMessage`), `state` (diff of `WorkspaceState`), `openDocument`,
    `closeDocument` (request: the WebView flushes and evicts the note's cached state), `showEditor`,
    `watchEvent`, `reply`.
  - Web → native: `ready`, `plugin` (`PluginHostMessage`), `commit` (request), `cursor`,
    `platformCall` (request), `serviceCall` (request: open file/view/markdown tab, bookmark
    add/remove/toggle, watch/unwatch), `command`, `communityStyles`, `reply`.
- `features/workspace/workspaceChannel.ts` (native) owns the channel: it queues plugin messages and
  `closeDocument` until `ready`, answers `commit` against the registered `NoteDocumentSession`
  (`updateBody(body, { baseRevision })`, stale revisions rejected), forwards only
  `forwardedPlatformMethods` (async, JSON-only `fs`, `notifications`, `app`, `clipboard` methods) to the
  real platform, runs service calls (`openMobileNote`, `openPluginView`, `openPluginMarkdownTab`,
  core bookmarks, `fs.startWatching`), and holds the layout and community styles stores.
  - Expo reloads a crashed WebView; every `ready` re-hydrates: after the first one the channel calls
    `uiMirror.dispose()`, rejects pending requests, stops watchers, clears styles, then sends the full
    state, the open document, and the editor visibility. The host mirror resends all plugin state.
- `features/workspace/workspaceState.ts` (native) is the state publisher: it subscribes to the vault,
  workspace, editor, bookmarks, tags, settings, hotkeys stores and the ThemeManager and sends only the
  keys that changed (`vaultPath`, `openFiles`, `activeFilePath`, `bookmarks`, `bookmarkedPaths`,
  `tags`, `themeName`, `editorConfig`, `themeTokens`, `hotkeyOverrides`, `capabilities`,
  `allowCommunityPlugins`).
- `features/workspace/workspaceRealm.ts` (web realm only) builds the WebView side: the mirrored state,
  `initPlatform` with a forwarding platform (async methods sent as `platformCall`, sync ones answered
  from mirrored state, everything else rejects clearly), and `createPluginHost` with
  `PluginHostServices` built from mirrored state (sync reads; `@cortex/core/bookmark-paths` and
  `@cortex/core/frontmatter` for pure helpers) plus `serviceCall` writes, `createCodeMirrorActiveEditor`,
  `pluginEditorRuntime`, and `community: { styles, loadEditorExternals, isAllowed }` (`isAllowed`
  reads the mirrored `allowCommunityPlugins`). Bundled plugins are registered once; per mirrored
  vault path it disables everything, unregisters community plugins, discovers
  `<vault>/.cortex/plugins`, and runs `loadEnabledPlugins()`; when only `allowCommunityPlugins`
  changes it runs `host.syncCommunityAccess()`. `createPluginHostMirror(host,
  send)` mirrors plugin UI to native. Never import native-only modules there.
- `features/workspace/WorkspaceWebView.tsx` owns the one `EditorView` with `documentKey = filePath`
  (`evictEditorDocument` after `closeDocument`), editor CSS, toolbar, slash menu, frontmatter state,
  and image resolution (`resolveNoteAssetPath`; vault paths resolve through
  `app.resolveFileAssetUrl`). Typing stays in the WebView: commits are debounced (750 ms) and flushed
  before native service/platform calls and commands, on document switch, on hide, and on blur; the cursor
  is sent only with a flush. Same-revision `openDocument` never replaces the editor content.
- `NoteEditorScreen` is a placeholder: it keeps `openNoteDocumentSession`, registers the session with
  the channel, the title, `PluginStatusMenu`, and `KeyboardAvoidingView`. While focused and after its
  (or an ancestor stack's) `transitionEnd`, it sends `openDocument` and shows the editor over its
  `measureInWindow` rectangle (re-measured on layout, e.g. keyboard). If `transitionEnd` has not
  arrived 400 ms after focus or `transitionStart`, it shows the editor anyway. Blur and
  `transitionStart` hide it. `WorkspaceHost` measures its own container with `measureInWindow` and
  positions the WebView by the difference, so it does not assume the container sits at the window
  origin.
- Editor theme tokens are `@cortex/theme` `generateCSSVariables(activeTheme)` plus
  `settings.appearance` font families and sizes (`features/editor/editorTheme.ts`); line
  heights and weights stay theme tokens like desktop. `mobile-code-mirror-editor.css` uses only
  theme variables (`--bg-primary`, `--text-primary`, `--border`, `--font-editor`, ...); do not add
  hard-coded colors or fallbacks.
- CodeMirror extensions, editor views, plugin modules, command functions, stores, and class
  instances stay inside the WebView; never pass them across the bridge. Native screens may import
  only the pure, CodeMirror-free `@cortex/editor/editor-config` and editor types.
- Markdown formatting command metadata and the toolbar layout (`markdownToolbarCommandIds`,
  `markdownToolbarShortLabels`) live in `@cortex/editor/markdown-format-commands`. The WebView
  registers those commands (`features/editor/editorCommands.ts`); do not keep a second mobile-only
  command or toolbar catalog.
- `features/editor/styles.d.ts` declares CSS side-effect imports for TypeScript 6.

## Development Scripts

- From the repository root, use `bun run dev:mobile` to start Expo. Platform entry points live in
  this package: `bun run --cwd apps/mobile ios` and `bun run --cwd apps/mobile android`.
- Use `bun run check:mobile` for the deterministic mobile gate: Expo lint plus TypeScript.
- Use `bun run doctor:mobile` after React-facing mobile changes. Use `bun run doctor:mobile:full`
  only for intentional broader cleanup.

## Platform Adapter

- `src/platform/expo-platform.ts` implements the full `@cortex/platform` shape and only assembles
  domain objects, like desktop `electron/ipc/register.ts`. Each domain file exports
  `xxxApi satisfies Platform["xxx"]` (or a `Pick` slice): `fs`, `watcher` (spread into `fsApi`),
  `vault`, `registry` (spread into `vaultApi`), `dialog`, `appearance`, `app`, `appUpdates`,
  `device`, `keychain`, `serverApi`, `notifications`, `sync`, `window`, `storage`, `clipboard`,
  `http`. Tiny domains (`font`, `documentImport`) stay inline in the assembly.
- Adapter infrastructure is layered without cycles: `errors`, `unsupported`, `nativePlatform`,
  `mobile-vault-paths` → `appStorage` (app dir, path guards, app-storage-only text/JSON IO; the
  vault root map and registry never go through the logical fs) → `vaultRoots` (root records,
  root-aware directory listing, the logical → actual URI cache behind accessors,
  `registerPickedDirectory`) → `pathResolver` (logical SAF resolution, entry metadata, and
  `routeStoragePath`, the single "logical vault path vs app storage" dispatch) → domain files.
- IDs use the global `crypto.randomUUID()` installed by `bootstrap/crypto.ts` before platform init.
- Mobile vaults use logical Cortex paths such as `/mobile-vaults/<uuid>`. The Expo adapter owns the
  persisted root map from logical path to native `file://` or Android `content://` directory URI.
  Shared stores and screens must not treat provider URIs as vault paths.
- App-data `file://` paths are not mobile vault paths. Adapter path guards must classify app
  storage before treating a path as a logical vault path. `mobile-vault-paths.ts` keeps only the
  logical root parsing; path joining, normalization, hidden-path rules, entry shaping and sorting,
  vault id/name, registry updates, hashing, and device ids come from `@cortex/platform/utils`,
  `/vault`, and `/hash`.
- `vault.openVault` does not scan (core scans once); `getVaultMetadata` scans to count files.
  `fs.writeFileSnapshot` and `fs.readFileSnapshot` resolve the SAF file once and hash in memory.
  Path-missing errors are `MobilePathNotFoundError`; only those let `readOrCreateVaultId` create a
  new id, so transient provider failures never overwrite `vault-id.json`.
- `keychain` uses `expo-secure-store` with keys encoded to SecureStore's `[\w.-]` alphabet;
  `clipboard` uses `expo-clipboard`; the device id is a persisted UUID from `getOrCreateDeviceId`.
- `auth`, `devices`, `members`, `subscription`, `remoteVault`, and `sync.checkVaultEncryption` come
  from `@cortex/sync-api` `createServerApiServices` over `createCachedSecretStore(keychain)`
  (`platform/serverApi.ts`). Its `onSessionExpired` calls `useAuthStore.getState().logout()`, the
  same handling desktop runs on `auth-session-expired`. Do not reimplement server requests in the
  adapter.
- `dialog.showConfirm`/`showAlert` normalize arguments with `@cortex/platform/utils`
  `toMessageOptions`, shared with desktop `electron-platform.ts`.
- `fs.downloadFile`, `fs.writeBinaryFile`, and `fs.readBinaryFile` go through `routeStoragePath`
  like text IO. `fs.downloadAndExtract` unzips with `fflate` `unzipSync` (pure JS, Hermes-safe) and
  writes every entry as bytes under `@cortex/platform/vault` `archiveEntrySegments` (top-level folder
  stripped, escaping paths rejected). fflate does not expose symlink attributes; entries are always
  written as regular files, so no symlink is ever created.
- Provider files are created with `text/markdown` for `.md` and `application/octet-stream` otherwise,
  so Android SAF keeps the requested name (`main.js`, `manifest.json`) instead of appending an
  extension. Expo cannot rename SAF documents, so `fs.renameFile` on `content://` entries moves into
  the existing parent when the name is unchanged, and otherwise creates the new directory/file,
  moves children (or copies bytes), and deletes the source.
- Android `content://` vault roots cannot be watched with Expo FileSystem in Expo Go. Return a
  no-op watcher and rely on manual refresh until a platform-specific watcher exists.
- Vault roots are `internal` or `external` (`platform/vaultRoots.ts`, persisted in
  `Cortex/mobile-vault-roots.json`). `vault.createVaultFolder` creates internal vaults in
  `Paths.document/Cortex/Vaults/<name>` and stores only the path relative to `Paths.document`, so they
  reopen after restarts and app updates without any permission.
- `dialog.pickFolder` (`Directory.pickDirectoryAsync()`) registers external roots. Android reopens
  through persistable URI grants. iOS external access is session-only: listing a lost root throws
  `MobileReauthorizationRequiredError` (`platform/errors.ts`), onboarding shows the vault as "Needs
  access", and "Reauthorize" re-picks the folder (`registerPickedDirectory` matches it by URI or vault
  id). Persistent security-scoped bookmarks need a native module and a dev build (follow-up).
- `readVaultRegistry` migrates entries whose name is the vault UUID to the folder name once.
- Keep the remote sync engine out of this foundation pass.
  Import/export contracts may be present on the platform shape, but unsupported mobile methods,
  including native PDF text extraction, should reject clearly until native document picker/share
  flows are implemented.
- Methods that are not real yet should reject clearly or return an explicit unsupported state. Never
  silently fake remote vault, search, or storage success. `sync.updateSyncPreferences` is
  the narrow exception: it resolves as a no-op on mobile so core can persist local preferences while
  the remote sync engine remains unsupported.

## Shared Runtime

- `useMobileRuntime` starts `startAppRuntime({ persistWorkspace: false, indexing: "lazy" })` from
  `@cortex/core`: NoteCache, vault session resets, and active-file tracking match desktop, without
  persisting desktop workspace layout or building search/tag indexes at boot. It calls
  `flushPendingWrites()` when `AppState` goes to `background`/`inactive`. Vault opening goes through
  core `openVaultSession`; never call `setActiveFile` manually.
- Plugins run in the workspace WebView (see Workspace WebView). `bootstrap/pluginHost.ts` exports
  `mobilePluginHost`, the `createPluginUiMirror` facade (enable/disable, settings, discover/reload,
  modals) that `PluginsSettingsScreen`, `PluginSettingsForm`, `PluginModalHost`, and the marketplace use, and
  `useMobileCommunityStyles()`.
- `features/themes/themeSync.ts` keeps the `@cortex/theme` ThemeManager active theme in sync with
  `appearance.theme`/`colorscheme` and `platform.appearance`; `useActiveTheme()` reads it.
  `useMobileRuntime` also loads per-vault hotkey overrides (`useHotkeysStore.loadOverrides`) in
  `onVaultOpened`, like desktop.
- `bootstrap/appCommands.ts` registers core `createFileCommandEntries` with `openMobileNote`;
  screens execute `file.new`, `file.duplicate`, and `file.delete` ids. The long-press sheet renders
  core `getFileEntryActions` (rename/move open local sheets), names use `validateEntryName`, move
  targets use `getMoveDestinations`, and errors use `reportAppError`/`getErrorMessage`.
- `NoteEditorScreen` uses `openNoteDocumentSession`; the properties runtime comes from
  `initializeCoreProperties({ deviceType: "mobile" })`, and the sidebar tree uses core
  `createFileTreeViewModel`.

## Plugin UI

- `features/plugins/` is the only native renderer for plugin UI. It maps data from
  `@cortex/plugin-host-core` and never re-implements host logic: `PluginView` drives
  `createPluginViewController` (lazy `activate`, `useSyncExternalStore`, remount on a new
  registration object, error boundary with a crash notice), and `PluginViewNodes` is the single
  map from every `ViewDescriptor` node type to React Native / `@expo/ui` components with the
  desktop payload rules (input string or number, textarea/select string, toggle/checkbox boolean,
  slider number, tabs value, button/item/list-item/table row `node.payload`).
- Buttons, items, rows, and tables are React Native `Pressable`s so long plugin lists stay cheap;
  form controls (`Switch`, `Checkbox`, `Picker`, `Slider`) are `@expo/ui` inside
  `Host matchContents`; text inputs use `MobileTextField`. Icons resolve Lucide names through
  `PluginIcon`/`resolvePluginIcon` (`lucide-react-native/icons`).
- The `markdown` node renders through `components/ui/MarkdownBlock`, a `"use dom"` component running
  the shared `@cortex/renderer` pipeline and sanitizer with the editor theme tokens. An optional async
  `onLinkPress(url)` prop intercepts link taps (external `http(s)`/`mailto` links go to native).
  Its root is a `.markdown-surface`; plugin views pass `pluginStyles`
  (`useMobileCommunityStyles()`), the scoped `styles.css` of enabled community plugins.
- Surfaces: `workspace.openView` (a WebView `serviceCall`) and drawer "Plugins"
  rows (`sidebarItems`, `features/sidebar/PluginSidebarSection`) call `openPluginView`, which
  pushes `app/(notes)/plugin-view` (`PluginViewScreen`, title from the registered view).
  `selectVisibleStatusBarItems` feeds the note header `Stack.Toolbar` menu (`PluginStatusMenu`);
  `selectContextMenuItems(state, "file", ...)` appends plugin actions to the entry context menu;
  `PluginModalHost` (mounted once in `AppGate`) presents `modalInstances` as page sheets with
  controlled state (`mobilePluginHost.updateModalState`/`closeModal`, forwarded to the host).
- Native plugin contributions are proxies: commands run through the WebView host and views are remote
  (`RegisteredView.remote`), rendered by the same `PluginView`.
- Settings lists plugins in a "Plugins" section (`features/settings/PluginsSettingsScreen.tsx`):
  `enablePlugin`/`disablePlugin` followed by `saveEnabledPlugins`, like desktop. Rows with a
  settings page push `app/(settings)/plugin-settings`, where `PluginSettingsForm` renders
  `resolvePluginSettingFields` with `@expo/ui` rows and writes through `setPluginSetting`
  (text and number fields commit on end editing).

## Community Plugins

- Community bundles never run in Hermes. They are discovered and evaluated by the plugin host in the
  workspace WebView with in-realm CodeMirror externals, exactly like desktop, and are never enabled
  automatically. Scoped `styles.css` is installed in the WebView document and sent to native
  (`communityStyles`) for plugin `markdown` nodes.
- There is no isolation: community plugins share the WebView realm with the editor, bundled plugins,
  and the bridge. Native limits the bridge to `forwardedPlatformMethods` and typed service calls;
  safety rests on opt-in, review, and scanning.
- Restricted mode is the shared app-level `plugins.allowCommunity` setting (off by default), enforced
  only by the WebView plugin host. `features/plugins/communityPluginsAccess.ts` owns the native
  helpers: `useCommunityPluginsAllowed`, `setCommunityPluginsAllowed` (confirms before turning on),
  and `enablePluginWithConsent` (shows the declared permissions through
  `getPluginEnableConfirmation`). Settings → Plugins starts with the "Allow community plugins"
  toggle; the marketplace list shows a "turned off" notice and the detail screen replaces
  Install/Update with "Allow community plugins to install" while it is off.

## Marketplace

- `@cortex/marketplace` owns registry, install/update/uninstall, and catalog selectors. Mobile
  renders `selectMarketplaceEntries`, `groupMarketplaceEntries`, and `getMarketplaceEntryState`; do not
  re-implement filtering, grouping, or action state in screens.
- `bootstrap/marketplace.ts` wires `setMarketplaceCallbacks` with `mobilePluginHost`, the vault themes
  directory (`<vault>/.cortex/themes`), `reloadCommunityThemes`, `isThemeInstalled` (`findThemeFamily`
  over the ThemeManager families), and `notify` (theme uninstall reloads the themes).
  `initializeMobileHost()` calls `registerMobileMarketplace()`.
- `MarketplaceScreen` (`app/settings/marketplace`): React Native `SectionList` rows (fixed-size artwork
  with a symbol fallback, status text on the right, no `Host` and no actions per row),
  `Stack.SearchBar`, a segmented kind control and a filter/sort toolbar menu, pull to refresh, `tab`
  param. `MarketplaceDetailScreen` is one `NativeForm` per kind with the install/update/uninstall
  actions; the README pushes `marketplace-readme` (`MarkdownBlock`).
- Install never enables a plugin; uninstall confirms through `dialog.showConfirm`. Plugin installed state
  reads `usePluginStore`; themes are the real registry entries, installed when `findThemeFamily` matches
  a loaded family (`useThemeFamilies()`), and "Use theme" writes `appearance.theme = family.name`.
  Templates come from `marketplaceAdapter.ts` fixtures.

## Settings and Theme

- Settings screens read and write `@cortex/settings` `useSettingsStore` with the desktop schema keys;
  no local-only setting state or mobile-only keys.
- Settings pages are one `NativeForm` each; the Settings index is a React Native `SectionList` so its
  large title collapses like Apple's. `features/settings/SettingsControls.{ios,android}.tsx`
  provides `SettingsPicker`, `SettingsSlider` and `SettingsTextField`. Appearance has a Theme menu
  picker (Default plus installed community families, `appearance.theme`) and a Light | Dark | System
  segmented control (`appearance.colorscheme`), like desktop. Settings Home search is
  `Stack.SearchBar`; only the index has a large title.
- Plugins: `PluginsSettingsScreen` (core/community toggles, "Allow community plugins", marketplace) and
  `PluginSettingsScreen` (`PluginSettingsForm` over `resolvePluginSettingFields`).
- `useSettingsColorScheme` (root layout) applies `appearance.colorscheme` through
  `Appearance.setColorScheme`. `src/theme/colors.ts` owns the native color roles derived from
  `@cortex/theme` tokens; do not add hard-coded palette hex values.
- Community themes (`features/themes/communityThemes.ts`) are vault files
  (`<vault>/.cortex/themes/<id>/manifest.json` + one CSS file per colorscheme). Mobile never injects
  CSS: it parses the `--name: value` declarations, resolves `var()` against the file and the base
  theme variables, keeps colors only (`cssColor.ts` normalizes hex/rgb()/rgba() to 6/8-digit hex),
  and maps variables back to token leaves through an inverse map probed once from
  `generateCSSVariables` (no copied variable table). Each family registers ink/paper-based `Theme`s
  with the derived tokens; the editor also receives the theme's raw color variables.
  `themeSync` loads them when a vault opens, unloads them when it closes or switches, and re-applies
  the active theme after every (re)load.

## Today, Tasks and Notifications

- `features/today/` owns the Today tab root (`TodayScreen`: native large title, toolbar buttons for the
  drawer, notifications and New task on iOS, FAB on Android, a SegmentedControl Today / Upcoming / Inbox,
  `SectionList` over `useTodayTasks`, which groups with `@cortex/tasks`; never re-group in screens),
  `TaskRow`, the `quick-add` sheet (`QuickAddSheet`, `quickAddActions.ts`: `ensureTaskInbox()` then
  `addTaskFromQuickAdd`, dismiss and toast "Added to Inbox", native Alert on failure) and
  `TaskDetailSheet` (`app/task.tsx`, one native form, saves one `TaskPatch` through `updateTask`).
  Platform form controls live in `TaskFormControls.{ios,android}.tsx`.
- Completing goes through core `toggleTaskWithUndo` + `revertTaskEditSafely` with `toastWithUndo`.
- `features/notifications/` owns Settings → Notifications (one `NativeForm` writing `settings.tasks`
  keys); permission, channels and the test reminder stay behind `notificationsAdapter.ts`
  (`// stub:`). `promptNotificationPermission()` shows a native Alert before the OS request.

## Sync, History and Recovery

- `features/sync/` owns Settings → Sync (`app/settings/sync/index|prefs|members|self-hosted|link|choose`,
  `sync-logs`), each page one `NativeForm` with `FormControls.{ios,android}.tsx` (`FormTextField`,
  `FormMenu`, `FormCheck`). Screens read `useSyncStore`, `useRemoteVaultStore`, `useDevicesStore`,
  `useSyncLogStore` and core presentation helpers.
- `syncAdapter.ts` is the only door to what the engine does not provide on mobile (`// stub:`).
  Linking a remote vault pushes `sync/choose`; unlinking confirms with a native Alert. Self-hosted
  secrets go to `getPlatform().keychain` under `createSyncEnvironmentSecretKey`.
- `features/members/membersAdapter.ts` maps `useMembersStore` data or fixtures (stubs).
- `features/history/` owns Version history (`version-history`, `version`) and Deleted notes
  (`settings/deleted-notes`, `deleted-note`) as React Native lists (`InsetListRow`) with native
  toolbars. `versionHistoryAdapter.ts` uses real local versions and falls back to fixtures;
  `deletedNotesAdapter.ts` is a fixture trash.
- `features/collab/PeopleSheet` (title "Share") and `features/comments/CommentsSheet` use native
  headers; `collabAdapter.ts` is the stub door to presence, members, invites and link sharing.

## Search, Quick Finder, Bookmarks and Tags

- Indexing stays lazy at boot. `features/search/vaultIndexing.ts` `useEnsureVaultIndexed()` runs
  `useSearchStore.indexVault` then `useTagsStore.buildIndexFromFiles` once per vault file list.
- Search tab: `Stack.SearchBar`; typed `tag:`/`path:`/`file:` words become filters shown in a header
  scope menu (no chips). Results come from `useSearchStore.runQuery`, one grouped row per note.
- `quick-finder` sheet: native title, `Stack.SearchBar`, filters (folder, tags, titles only, sort,
  Commands) in a toolbar menu, a Create row when nothing matches exactly, recent files when empty.
  `>` or "Commands" opens `command-palette`. Params `query`, `folder`, `relinkBookmark`.
- `features/search/ListCell.tsx` is the shared inset list row; `RowContextMenu.tsx` wraps rows in the
  iOS `Link.Menu` context menu.
- Bookmarks, Tags and Tag page use `Stack.SearchBar`, toolbar menus and context menus; tag rename and
  colours live in `features/tags/tagActions.ts`.

## Templates and Sync Conflicts

- `features/templates/` owns New from template (`app/from-template/` stack: list + `preview`),
  Insert template (`app/insert-template.tsx`), the template editor (`template-editor`, Preview | Source
  in the toolbar, "New note settings" pushes `template-settings`) and Settings → Templates.
- Data comes from `useTemplateStore` and `@cortex/templates`; `templatesAdapter.ts` (`// stub:`) seeds
  team and marketplace template fixtures.
- `features/importExport/` owns Import (`app/import/` stack: source, Obsidian, progress, review,
  preview, result) and Settings → Import & export; `features/share/` owns Share as template
  (`app/share-template/`). Shared native form fields live in `importExport/FormFields.*` and header
  buttons in `importExport/HeaderActions.tsx` (`useCloseSheetStack()` closes a nested sheet).
- `features/conflict/` owns the `conflict` screen (Keep local / Keep remote in the toolbar,
  `conflictAdapter.ts` stubs, diff from core `buildDiffRows`).

## Files, Note Chrome and Properties

- `features/files/` owns the Files tab root and `folder` route: a `SectionList` built by
  `useFilesScreenModel`, rows with swipe (Bookmark, Delete) and the native context menu
  (`features/file-explorer/EntryContextMenu`, `entryActions.ts` over core `getFileEntryActions`,
  `validateEntryName`, `getMoveDestinations` and the `file.*` commands, plus plugin context items).
  The root title is the vault name; Create / More menus come from `filesMenus.ts`.
- The drawer (`features/sidebar/`) shows the vault switcher row, Today, Databases, the file tree,
  Plugins, Marketplace and Settings over the `sidebarBackground` token.
- `features/note/NoteScreen`: native title and ⋯ toolbar menu; `NotePropertiesBlock` shows the
  properties above the editor (first 4 rows, "Show all", collapsible per session, hidden while
  editing); tapping a row opens the `properties` sheet on that property's editor; while reading, one glass `NoteBottomMenu` button
  (Find or create a note, New note, Open tabs); while editing, the glass `KeyboardToolbar` above the
  keyboard (Heading, Bold, Italic, Task, List, Link, More menu, Hide keyboard) sends command ids from
  `@cortex/editor/markdown-format-commands` plus `mobile.insert-divider`, `mobile.insert-tag`,
  `mobile.insert-wikilink`, `mobile.slash` through the `command` message. Nothing about properties is
  rendered inside the WebView. The WebView never scrolls: `html`/`body` are fixed height and
  `.cm-scroller` is the only scroller; the shell sets `--markdown-content-gutter: 16px` so blocks
  align with text.
- Protocol additions: native → web `find` (request answered with `{ current, total }`) and `command`
  with `mobile.blur`, `mobile.focus`, `mobile.reveal-line` or any registered editor command id.
- `app/properties/` stack (`index`, `add`, `edit`, `option`, `value`, `select`, `person`, `date`,
  `tags`, `auto`) shares one `useNoteProperties` through `PropertiesContext`; controls live in
  `PropertyControls.{ios,android}.tsx`.
- `outline`, `export` and `tabs` sheets use native headers and lists.

## Databases

- `features/database/` owns the database screen (`database`), the row page (`database-row`), the view
  options sheet (`db-view-options`, one titled `NativeForm` per chip) and New database (`db-new`,
  `NativeForm`).
- `useDatabaseView` is the single data hook (`retainDatabase`, `useDatabaseStore`, the vault schema
  snapshot, `@cortex/properties/database`). Never filter, sort or group rows in screens.
- Table, board, calendar and gallery views stay React Native; headers, toolbars, search and menus are
  native. The status chooser is a SwiftUI `ConfirmationDialog` on iOS and a Compose `AlertDialog` on
  Android. `databaseAdapter.ts` (`// stub:`) supplies fixture row templates and team presets.
