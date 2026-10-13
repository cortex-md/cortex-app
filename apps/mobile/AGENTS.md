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
  components/ui/          # Shared primitives: MobileTextField, SheetActionButton, ActionSheet,
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
  Bottom sheets compose `components/ui/ActionSheet`.

## UI Rules

- Use `@expo/ui` universal components for settings-style grouped controls, toggles, sliders,
  buttons, menus, and similar native controls.
- The main workspace follows the Inkdown mobile shell as a visual/UX reference only: calm
  onboarding before any shell, workspace switcher at the top of the drawer, icon action bar,
  Lucide file tree rows, and long-press bottom sheets. Do not import Inkdown code or business
  logic.
- Do not use `@expo/ui` `TextInput` in mobile forms until the Android Expo Go view-config warnings
  are resolved. Use the app-local React Native `MobileTextField` wrapper for onboarding and sheets.
- Do not import `@cortex/ui`; desktop/web primitives are not mobile shell components.
- Do not add Electron, IPC, Node, browser DOM, or desktop-only platform imports to native React Native
  screens.
- Do not use `SafeAreaView` for route chrome. Let Expo Router native tabs/stacks and automatic
  content insets own safe areas; scroll screens should use
  `contentInsetAdjustmentBehavior="automatic"`.
- Future large note lists should use virtualized React Native list surfaces, not `@expo/ui` `List`.
- Note lists use React Native virtualized lists. Use `@expo/ui` for sheets, grouped controls,
  settings rows, and other native controls around those lists.
- Native note actions should live in stack header actions, gestures, context sheets, and swipe
  affordances. Keep large note collections on `FlatList`.

## App Gate and Onboarding

- `AppGate` renders startup state from `useMobileRuntime`, which runs core `bootstrapApp()`
  and `openLastVault()` (the registry's most recent vault, honoring `autoOpenLastVault`). There is no
  mobile-only startup file.
- If no vault opens during startup, render only `OnboardingScreen`. Do not mount the sidebar,
  stack shell, file list, or workspace chrome before onboarding completes.
- Mobile onboarding should stay calm and focused: pick a vault folder, collect vault identity
  (name, icon), save basic sync preferences through core, then open the pending welcome note.
- The sidebar is workspace-only. Vault creation/opening belongs in onboarding and vault-switcher
  flows, not in an empty notes list. The switcher's "Browse folder" uses core `resolvePickedFolder`;
  new folders open `OnboardingScreen` with `initialFolder` in a modal so they get the same
  create flow (`createVaultFromFolder`) as desktop.

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
- `dialog.pickFolder` is implemented with `Directory.pickDirectoryAsync()`. Android should reopen
  through persistable URI grants. iOS scoped directory access may need reauthorization after restart;
  surface that as an explicit reauthorize/open-folder state instead of silently falling back.
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
  modals) that `PluginsSettings`, `PluginSettingsForm`, `PluginModalHost`, and the marketplace use, and
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
  `selectContextMenuItems(state, "file", ...)` appends plugin actions to `EntryActionsSheet`;
  `PluginModalHost` (mounted once in `AppGate`) presents `modalInstances` as page sheets with
  controlled state (`mobilePluginHost.updateModalState`/`closeModal`, forwarded to the host).
- Native plugin contributions are proxies: commands run through the WebView host and views are remote
  (`RegisteredView.remote`), rendered by the same `PluginView`.
- Settings lists plugins in a "Plugins" section (`features/settings/PluginsSettings.tsx`):
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
- Mobile shows plugins only. Community themes are CSS and mobile theming is token-based, so
  `bootstrap/marketplace.ts` wires `setMarketplaceCallbacks` with `mobilePluginHost` (the UI mirror
  facade; reloads run in the WebView host), no themes
  directory, and `notify` (`reportAppError` for failures, a `dialog.showAlert` after an install).
  `initializeMobileHost()` calls `registerMobileMarketplace()`.
- Settings → Plugins has a "Browse community plugins" row that pushes `app/(settings)/marketplace`
  (`MarketplaceScreen`: `SectionList` grouped Updates/Installed/Available, `Stack.SearchBar`,
  `Stack.Toolbar` menu for "Installed only" and sort, pull to refresh). Rows push
  `marketplace-detail` (`MarketplaceDetailScreen`: `@expo/ui` `FieldGroup` with actions, compatibility,
  information, permissions); its README row pushes `marketplace-readme` (`MarkdownBlock`), so the
  WebView only starts when the README is opened. Navigation helpers live in
  `features/marketplace/marketplaceNavigation.ts`.
- Install never enables a plugin; the user enables it in Settings → Plugins. Uninstall asks through
  `dialog.showConfirm`. Installed state reads `usePluginStore` records so screens re-render when the
  host registers or removes a plugin.

## Settings and Theme

- The Settings screen reads and writes `@cortex/settings` `useSettingsStore` with the desktop schema
  keys (`general.autoOpenLastVault`, `appearance.colorscheme`, `appearance.editorFontSize`,
  `editor.wordWrap`, `editor.showLineNumbers`, `editor.slashCommands`, `plugins.allowCommunity`). Do not keep local-only
  setting state or invent mobile-only keys; persistence follows `SettingsManager` rules.
- `useSettingsColorScheme` (root layout) applies `appearance.colorscheme` through
  `Appearance.setColorScheme`, so `useColorScheme()` and native chrome follow the setting.
- `src/theme/colors.ts` owns only the native `PlatformColor` mapping. Hex fallbacks,
  `mobileStaticColors`, and `mobileIconColors` derive from `@cortex/theme` `paperTheme`/`inkTheme`
  tokens; do not add hard-coded palette hex values.
