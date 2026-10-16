# AGENTS.md — apps/desktop

Electron desktop app: a TypeScript main process plus a React 19 + Vite renderer that composes the
`@cortex/*` packages. Read the root `AGENTS.md` first; this file covers desktop-only rules.

## Structure

```
electron/                 # Main process (Node)
  main.ts                 # Single instance, deep links, app/window lifecycle
  window.ts               # BrowserWindow options, native materials, navigation guards
  windows.ts              # Window registry: one main window per vault, shown after the first React commit
  dock.ts                 # macOS Dock menu and Windows jump list (recent vaults, New Window)
  preload.ts              # contextBridge: window.cortex.invoke / window.cortex.on
  security.ts             # Path allowlist, trusted sender/URL checks, external URL protocols
  protocols.ts            # cortex-app:// renderer scheme (V8 code cache) + cortex-file:// assets (allowlisted paths)
  ipc/register.ts         # MainApi object → single typed invoke handler
  menu.ts, events.ts      # Command-driven application menu + typed main→renderer events
  services/               # fs, vault, registry, watcher, dialog, keychain, documents, sync bridge…
src/                      # Renderer
  main.tsx                # initRenderer() then mounts App
  App.tsx                 # initializeDesktopHost() + shell composition only
  bootstrap/AppLifecycle.tsx # Main-window lifecycle hooks (startup, runtime, sync)
  windows/                # useNativeMenuState: commands + checked/enabled state for the native menu
  bootstrap/              # desktopHost, pluginHost, appCommands, commandHotkeyBridge, coreContributions
  features/               # Feature modules (file explorer, split view, sync, settings, …)
  hooks/                  # Lifecycle hooks and shared desktop hooks
  utils/                  # context-menu, createModalStore, modals (every global modal store), format
electron.vite.config.ts   # main (+ sync-worker), preload, renderer builds
electron-builder.yml      # Packaging and updater feed
```

Typecheck projects: `tsconfig.json` (renderer), `tsconfig.electron.json` (main/preload),
`tsconfig.node.json` (build config). Validate with `bun run typecheck` and
`npx electron-vite build --config electron.vite.config.ts`.

## Main Process and IPC

- Windows run with `contextIsolation`, `sandbox`, and no `nodeIntegration`. New windows and
  untrusted navigation are denied and opened externally after `assertExternalUrl`
  (http, https, mailto only).
- IPC is one channel. `electron/contract.ts` defines `MainApi` (domains such as `fs`, `vault`,
  `dialog`, `sync`) and `MainEvents`; `electron/ipc/register.ts` implements `MainApi` and every call
  passes `assertTrustedSender`. The renderer reaches it only through `electronPlatform` from
  `src/platform/electron-platform.ts` (same role as mobile's `expo-platform.ts`) behind `getPlatform()`; UI code never calls `window.cortex` directly.
  Dialog message arguments are normalized with `@cortex/platform/utils` `toMessageOptions`, shared
  with mobile. Mobile's `src/platform/` mirrors `electron/services/` (one `xxxApi` per domain).
- To add a command: add the method to the `@cortex/platform` interface and `MainApi`, implement it in
  `electron/services/`, and wire it in `electronPlatform`. Events use `emitToRenderer` with a typed
  `MainEvents` name.
- File-system services must resolve paths through `assertAllowedPath` (user data, temp, registered
  vaults, and paths granted by dialogs). The credentials file is never readable from the renderer.
- `services/{fs,vault,registry,watcher,device}.ts` keep all IO in main but call the pure rules from
  `@cortex/platform/{hash,vault,utils}` (entry shaping/sort, hidden paths, vault id and name from
  `.cortex/vault-metadata.json`, registry ops with `lastOpened` in milliseconds, device id). Main
  bundles `@cortex/platform`. Only packages in `dependencies` stay external to main; keep that list
  to what main loads at runtime (`adm-zip`, `electron-updater`, `font-list`, `write-file-atomic`) and
  put renderer and workspace packages in `devDependencies` so electron-builder does not pack them.
- Sync runs in a `utilityProcess` worker built from `packages/sync-engine/src/worker.ts`;
  `services/syncBridge.ts` owns it. `services/serverApi.ts` wires `@cortex/sync-api`
  `createServerApiServices` over the main-process keychain, so auth, devices, members,
  subscription, and remote-vault HTTP calls (and tokens) stay in main; only desktop main emits
  `auth-session-expired`. Account key derivation (`nodeAccountKeyCrypto`) and the identity
  private key (`identity_<userId>` in the keychain) stay in main as well. The worker asks main for
  the VEK through `getVek`, which opens the user's sealed vault key when no local VEK exists and
  re-registers the own sealed row in the background; main caches the worker's
  `sync-access-changed` payload for `sync.getAccess()`. Deep links such as
  `cortex://reset-password?token=&server=` reach the renderer through the generic `deep-link-open`
  event like `cortex://invite/…`. Marketplace downloads use
  `fs.downloadFile` / `downloadText` in the main process to avoid renderer CORS limits.
- Live collaboration transport is `services/collab.ts` (`MainApi.collab`). The renderer generates a
  `channelId` per `Collab.open`, registers its `collab-event` route first, and gets
  `{ channelId, event }` events only on the owning webContents. Main fetches a ticket through
  `serverApi.client()` + `createCollabTicket`, derives the collab key from the keychain VEK (cached
  per vault, the VEK never leaves main), opens Node's global `WebSocket` (`binaryType =
  "arraybuffer"`, `frames=binary`), opens/seals every payload with `@cortex/collab/wire`, and
  maps JSON control messages and close codes to `CollabChannelEvent`s. Main never reconnects; the
  renderer session calls `open` again. `availability` checks sign-in, the server `features.collab`
  capability (cached 5 min), and the VEK. `setFileSyncRole` stores roles per owner session in
  `syncBridge` (`setCollabRole`), re-sent on worker respawn and cleared on `sync.stop`. Channels
  and roles of a webContents are dropped when it reloads or is destroyed. Main bundles
  `@cortex/collab`; the renderer dedupes `yjs` and
  `@codemirror/state|view`.
- macOS uses `trafficLightPosition` and `vibrancy: "sidebar"`, Windows uses Mica, both gated by
  `appearance.nativeWindowEffects` (applied on relaunch). Do not add CSS blur over native materials.

## Renderer Bootstrap

`bootstrap/desktopHost.ts` (`initializeDesktopHost()`) runs once: registers app commands, the
hotkey bridge, core contributions, bundled plugins, and Marketplace callbacks. `bootstrap/pluginHost.ts`
creates the single `pluginHost` with `@cortex/editor/extensions` `pluginEditorRuntime` and
`activeEditor: createCodeMirrorActiveEditor(coreServices.activeEditor)` for `ctx.editor.*`, and
`community.isAllowed` reading `settings.plugins.allowCommunity` (restricted mode, enforced by the
host). `hooks/useCommunityPluginLifecycle.ts` calls `pluginHost.syncCommunityAccess()` when the
setting changes. `features/plugins/communityPluginsAccess.tsx` owns the toggle helpers
(`useCommunityPluginsAllowed`, `setCommunityPluginsAllowed`, `enablePluginWithConsent`) and the
`CommunityPluginsNotice` used by Settings → Plugins and the Marketplace.
Editor config comes from `@cortex/editor/editor-config` `createEditorConfig` (panes and template
editor), image/asset URLs from `@cortex/editor/note-assets` `resolveNoteAssetPath`, and the Markdown
toolbar ids from `markdownToolbarLayout` in `@cortex/editor/markdown-format-commands`. Core sidebar views, tab views, and status bar items
are registered in `bootstrap/coreContributions.tsx` with owner `"core"`; `App.tsx`, `PaneView`,
and `StatusBar` render from that contribution store only. Core settings pages live in
`features/settings/coreSettingsPageRegistry.ts`; plugin settings pages still come from the
contribution store. Lifecycle effects live in dedicated hooks. The native menu is declared in
`electron/menu.ts` by command id; every item sends `menu-command { id, payload }` to the target
window and `hooks/useNativeMenuEvents.ts` runs it (keyboard shortcuts are handled by the renderer
hotkey listener, menu items only display them). `windows/useNativeMenuState.ts` sends the command
list through `menu.setCommands` only when the registry or hotkeys change, and the small
checked/enabled snapshot through `menu.setItemStates` with a signature guard; main mutates
`MenuItem.checked`/`enabled` in place and rebuilds the menu only when the command list, the vault
registry or the window list changes. Add new menu entries as registry commands first.

## Windows

To test two users on one machine during development, start `bun run dev`, then run
`bun run --cwd apps/desktop dev:profile user-b`. `electron/profile.ts` gives that instance its own
`userData` (credentials, device id, recent vaults) and window titles show `[user-b]`; it is ignored
in packaged builds. Each user needs a separate local folder linked to the same remote vault.

Each main window owns at most one vault. `vaultStore.openVault`/`switchVault` call
`window.claimVault(path)`; when another window already owns the vault it is focused instead.
Recent vaults (Dock, jump list, File › Open Recent, vault switcher, Settings › Vaults) open with
`window.openVaultWindow(path)`; Option-click or the item context menu opens in the current window.
Main routes menu, deep-link, watcher, and sync events to the owning or focused window only, and keeps
one sync worker per window. Window bounds are remembered per vault (`services/windowState.ts`).

## Plugin Rendering

- `features/plugins/` owns the React DOM rendering of plugin contributions: `rendering/PluginViewRenderer`,
  `rendering/PluginModalHost`, `rendering/PluginSettingsRenderer`, and `pluginMarkdownStyleHost`
  (`webPluginMarkdownStyleHost`, passed to the plugin host's `community.styles`). It lives under
  `src`, so Tailwind needs no extra `@source` entry.
- View logic lives in `@cortex/plugin-host-core` `createPluginViewController` (lazy activation,
  `render`, `reduce`, `onAction`, controlled or internal state, error capture). `PluginViewRenderer`
  is a tiny hook over the controller plus a node-to-component map; it keeps one React error boundary
  per view for component crashes. Never re-implement view state or dispatch here.
- `PluginSettingsRenderer` maps `resolvePluginSettingFields` output (defaults and number clamping
  already applied) to host controls passed as props. Do not mirror plugin setting values into React
  state. `StatusBar` uses `selectVisibleStatusBarItems`; plugin context menu entries come from
  `selectContextMenuItems` and are mapped to `MenuItem` in `features/plugins/pluginContextMenu.ts`.
- Plugin view descriptors are discriminated unions with top-level fields and optional `key`; never
  reintroduce `props`, free `className`, inline styles, arbitrary React components, or DOM event
  handlers into the renderer. Render descriptors through named components.

## Commands and Menus

- `bootstrap/appCommands.ts` is the desktop command catalog; editor and table commands come from
  `@cortex/editor/editor-command-entries`, and `file.new`, `file.duplicate`, `file.delete`, and
  `navigate.daily-note` come from `@cortex/core` `createFileCommandEntries`. Read stores inside
  `execute(context)`. Errors go through `@cortex/core` `reportAppError`.
- Startup is `bootstrapApp()` then `openLastVault()` (or the `?vault=` window param) from
  `@cortex/core`; `beforeunload` calls `flushPendingWrites()`. Folder picking for open/create goes
  through `openAddVault`/`openRecentVault` in `features/vault/vaultActions.ts`, which use
  core `resolvePickedFolder`, `openVaultSession`, and `createVaultFromFolder`.
- Every keyboard-reachable action (palette, hotkeys, Vim, native menu, context menus, slash commands,
  toolbar) executes a command id. Targets travel in `context.payload` (`{ filePath }`,
  `{ tabId, paneId }`); without a payload, file commands use the active editor file.
- Context menus are `MenuItem[]` built at open time with `commandMenuItem(id, { text, payload })`
  from `utils/context-menu.ts`. Builders: `features/file-explorer/fileMenu.ts` (file tree and note
  header; rename/duplicate/delete come from core `getFileEntryActions`),
  `features/split-view/tabMenu.ts`, and `EditorContextMenu`. Tree drag targets use core
  `canMoveEntryTo`. `getPluginMenuItems` appends
  plugin `contextMenuItems`; `useContextMenu()` shows the list through the single native menu
  instance or the Radix fallback. Shortcuts render with `formatHotkeyDisplay`. Never write a
  separate native and Radix copy of a menu.
- `file-explorer.*` commands reach the mounted tree through `setFileExplorerCommandHandler`.
- `@cortex/commands/hotkeys` stores bindings only; command `hotkey` metadata is mirrored by
  `bootstrap/commandHotkeyBridge.ts`.

## Obsidian Import

- `import.obsidian` ("Import from Obsidian…" in the File menu and the Import settings page) picks a
  folder outside the current vault and opens `obsidianImportModal` (`features/import-export/
  obsidianImportModal.ts`, kept tiny so `App.tsx` does not load `@cortex/import-export`). The lazy
  `ObsidianImportDialog` asks for a destination folder and whether to apply attachment/daily note
  settings, shows progress with Cancel, then the summary (content, settings migrated, findings).
- Opening a new folder that contains `.obsidian` shows "Use Obsidian settings" in
  `CreateVaultModal`; the vault is created without the onboarding note and the same dialog runs in
  `adopt` mode (`analyzeObsidianVault` + `applyVaultSettingsImport`), leaving notes untouched.
- Daily note folder, date format, and template live in the Templates settings page
  (`features/templates/DailyNotesSettings.tsx`); folder options come from
  `useSettingsVaultFolders`.

## Templates

- Templates are managed in workspace tabs, not in Settings. `features/templates/templateActions.ts`
  owns `openTemplatesView` (`TEMPLATES_VIEW_ID`), `openTemplateEditor` (`TEMPLATE_EDITOR_VIEW_ID`)
  and the `newTemplateModal`; view ids live in `templateViewIds.ts` so the tab bar and contributions
  do not import feature code. Settings → Templates is a summary page that leaves Settings through
  `runSettingsAction("openTemplates" | "openNewTemplate")`.
- Entry points: note ⋯ / file menu "Save as Template…" (`templates.save-note-as-template`), the
  sidebar + menu ("Note from a template…", "New template…"), and the commands `templates.create-note`,
  `templates.new`, `templates.manage`. `templates.create-note` has no default hotkey because
  ⌘⇧N belongs to `window.new`.
- `CreateFromTemplateDialog` is the picker: a `Command` list grouped by Recent / Your templates /
  From {group} / Blank, a live `TemplateNotePreview`, a per-template title and `FolderPicker`.
  `useUIStore.openCreateFromTemplate(templateId?)` preselects a template ("Try it", "Use").
- `TemplateEditorView` edits a template in a tab: the body is a CodeMirror document without
  frontmatter, properties are edited in rows, `{{ }}` values render as `Tag` chips through
  `templateValueChipsExtension` (code mode shows raw text) and `{{` opens the value menu through the
  shared `slashCommandExtension` trigger. Saves are debounced through `templateStore.updateTemplate`;
  shared templates republish after edits settle.
- `/template` in a note comes from `getTemplateSlashItems` (ids prefixed `template:`), which
  `ActiveTabEditor.executeSlashCommand` routes to `insertTemplateIntoNote`: it inserts the body at
  the cursor, merges only missing properties through the properties runtime and offers Undo.
- Sharing goes through `ShareTemplateDialog` (`shareActions.ts`), the core `templateSharing`
  runtime and `getPlatform().templateShares`. Team templates are refreshed by `useTeamTemplates`
  (vault, auth, sync link or `templates.showTeam` changes and window focus). `cortex://t/{slug}`
  links open Marketplace → Templates (`useTemplateDeepLink`).
- Marketplace → Templates is a desktop-only tab value (`MarketplaceViewTab = MarketplaceTab |
  "templates"`); `@cortex/marketplace` stays plugins/themes only.
- New database is the `NEW_DATABASE_VIEW_ID` page (`features/databases/NewDatabaseView.tsx`), opened
  with `openNewDatabaseView({ parentPath, mode, preset })`; team and Marketplace database templates
  pass a `DatabasePreset`.

## Modals and Lazy Surfaces

Global modal targets use `createModalStore<T>()` with one mounted host. `utils/modals.ts` owns every
app-level modal store (quick finder, command palette, tag picker, create-from-template, auth,
reset password, Obsidian import, note history, note share, manage access) plus the `toggle*`/`open*`
helpers; `features/settings/settingsModal.ts` owns Settings. `uiStore` in `@cortex/core` keeps only
layout state (sidebars, quick finder preview). `embedModal` + `features/embeds/EmbedHost.tsx` host
drawing and Mermaid embeds. Diff rendering goes through the lazy `features/sync/DiffViewer.tsx`, and
`shiki` is aliased to `features/sync/shiki/bundle.ts` (JavaScript regex engine, ~20 grammars) so the
full grammar set never ships. Dialogs render their content only while open through
`ModalHost` (`open`/`onOpenChange` props) or `ModalStoreHost` (a `createModalStore` target passed to
a render function) from `utils/ModalHost.tsx`. Overlays in `App.tsx` are `lazyNamed` components:
`preloadOverlays` resolves every chunk at idle and the wrapper renders the resolved component
synchronously, so the first open never suspends; `CommandDialog` uses the `fade` dialog motion. Relative "edited N minutes ago" labels read `hooks/useMinuteNow`, one shared
interval for every subscriber. Search snippets render through `features/search/HighlightedSnippet`.

## Search Worker

Vault search runs in a dedicated Web Worker. `initRenderer()` calls
`setSearchBackend(createSearchWorkerBackend())`; `features/search/searchWorkerBackend.ts` starts
`features/search/searchWorker.ts` lazily on the first call (Vite `new Worker(new URL(...))`) and
forwards each `SearchBackend` method as one ordered
`{ id, method, args }` message (`searchWorkerProtocol.ts`). The worker hosts
`createLocalSearchBackend()` from `@cortex/search/backend`: MiniSearch, fingerprints, persisted
index parse and serialization never run on the renderer main thread. The worker has no IPC access;
the renderer reads note batches and the index file through `getPlatform()` and posts the text.
The Quick Finder requests titles per keystroke and keeps the previous results until the response
for the current query arrives (latest query wins); Enter pressed while results are pending opens
the first result once they arrive, and title search waits while the index is still loading. The
Quick Finder preview is plain text (`stripMarkdown`), not a rendered Markdown pipeline.

## Settings and Appearance

Settings is an overlay in the main window (`features/settings/SettingsOverlay.tsx`, a lazy
`Dialog` mounted by `App.tsx`). Open it with `openSettings(section, fieldId)` from
`features/settings/settingsModal.ts`; the `app.settings` command accepts `{ section }` as payload so
native menu items (Settings…, Manage Plugins…, Keyboard Shortcuts) route through it. The overlay
renders `SettingsView` (`SettingsNav` + `SettingsPageHost`, which keeps visited pages mounted with
`<Activity>`). Pages that need the vault file list read it through `useSettingsVaultFiles()`, which
scans only while that page is visible. Actions that leave Settings (vault switch, Marketplace,
import, templates, history dialogs) go through `runSettingsAction(name, payload)` in
`features/settings/settingsActions.ts`, which closes the overlay first.

Settings search lives in the sidebar (`SettingsNav` + `SettingsSearchResults`). The index comes from
`useSettingsSearchItems` (catalog fields, self-hosted environment fields, plugin schema fields, plugins,
templates). Rows expose `data-settings-field`: pass `fieldId` to `SettingsField`/`SettingsSection` (the
label and description then come from `SETTINGS_FIELDS`), or set the attribute on dynamic rows.
`useRevealSettingsField` scrolls to, focuses, and highlights the target; collapsed containers open
themselves via `useSettingsRevealTarget`. Deep link to a field with
`useUIStore().openSettings(section, fieldId)`.

Pages compose `SettingsPageHeader`, `SettingsPage`, `SettingsSection`, `SettingsGroup`,
`SettingsGroupContent`, `SettingsField`, `SettingsList`, and `SettingsEmptyState`. Feedback colors use
`status-error-*`, `status-success-*`, `status-warning-*`; group surfaces use `settings-group-*`.

Appearance overrides only font families and sizes; weights and line heights stay theme tokens.
Community theme CSS is injected as opaque text; desktop must not parse it into tokens.
Custom accents update `--text-on-accent` and related foregrounds; dark styling keys off
`body[data-theme-scheme]`.

## Workspace Layout

- `SplitPane` renders the workspace tree; `PaneView` owns each pane's tab bar, file tabs, and view
  tabs. Each pane keeps CodeMirror mounted for the active file tab plus the 3 most recently used
  inactive ones (`MAX_MOUNTED_INACTIVE_FILE_TABS`). Split and sidebar resizers update the DOM during
  the drag and commit to the store once on release.
- Tabs sit in a pill track: inactive tabs size to their title between 72px and 180px, the active
  tab keeps up to 260px; motion stays limited to create, close, and drop states. `DropZoneOverlay` handles center/edge split drops; `TabBar` owns insertion targets.
- `SidebarRail` owns left-sidebar navigation: a 48px icon rail with core views before plugin
  views, then Marketplace (with an update badge) and Settings at the bottom. Collapsing the sidebar
  keeps only the 76px rail. `SidebarViewStage` keeps visited views mounted under `<Activity>`; a
  vanished plugin view falls back to Files.
- `FileSidebar` virtualizes the flattened tree (`@tanstack/react-virtual`) built by `@cortex/core`
  `buildFileTree`/`projectVisibleFileTree`. Rows are 32px in a 36px step with 18px indentation.
- The window ground is the sidebar material (`--sidebar-bg`, or native vibrancy on macOS); each
  pane's content is a floating card (`--workspace-card-radius`, `--workspace-card-shadow`) and the
  tab bar and status bar stay transparent above and below it. macOS uses a 40px overlay titlebar;
  titlebar drag regions must not cover the sidebar toggle.

## Marketplace and Billing

Marketplace is a workspace view under `features/marketplace/`, opened with `openMarketplaceView(tab)`,
never through Settings. Billing returns via the runtime-only deep link
`cortex://sync/checkout-complete`, handled by an already-running app after force-refreshing the
subscription.

Vault invites open through `cortex://invite/{token}#k={linkKey}` (`hooks/useInviteDeepLink.ts`):
the app previews the invite, asks to join, accepts it, and stores the vault key from the fragment.
Settings → Sync → Account (`settings/sync/SyncAccount.tsx`) edits profile, photo, email and
password, shows the Encryption section (fingerprint, recovery key, key setup for legacy sessions)
and lists devices with their last sync of the linked vault. Members
(`features/sync/MembersPanel.tsx`) is split into People / Groups / Settings tabs with a key trust
banner (`KeyTrustBanner`, "Verify and grant"). People (`PeopleTab`) invites through `InviteDialog`
and edits guest paths through access rules in `GuestAccessDialog` (`GuestAccessEditor` is only a
path list editor); Groups (`GroupsTab`) create and edit through `GroupDialog`; tenant settings stay
in `VaultAccessSettings`. Every user picture renders through
`features/sync/UserAvatar.tsx` (`UserAvatar`, `UserFacepile`) and group members are picked with
`PrincipalPicker`. Vault linking (`VaultLinkModal`) never asks for a vault password: it creates or
requests the vault key and shows a waiting state, with the legacy vault password only as fallback.
Recovery keys are shown once through `features/auth/RecoveryKeyPanel.tsx`;
`cortex://reset-password?token=&server=` (`hooks/useResetPasswordDeepLink.ts`) opens
`ResetPasswordDialog`.

Notes are shared from the `sync.share-note` command (file and tab menus) with
`features/sync/NoteShareDialog.tsx`: an encrypted public link (`noteShareBundle.ts` renders with
the export surface and embeds images) in `PublicLinkCard`, plus the shared `ShareAccessPanel`
(`AddPeopleField` for members, groups and guest invites by email, general access, entries). Folders
use `sync.manage-access` and `ManageAccessDialog` with the same panel and no public link. Non-writable paths open
read-only: `ActiveTabEditor` adds a read-only CodeMirror extension, the note header shows "Read only",
and the explorer, menus, drag and drop and templates hide or refuse writes. `hooks/useLiveNoteShares.ts`
republishes a shared note after this device pushes a new version. `cortex://s/{id}#k=...`
(`hooks/useSharedNoteDeepLink.ts`) opens `SharedNoteView`, which can save a copy into the vault.

## Live Collaboration

- `ActiveTabEditor` calls `useCollabNote(filePath, isActive)` and passes the binding to
  `EditorView`/`SideBySideView`; a live viewer (`snapshot.canWrite === false`) is read-only.
  `useNoteDocumentSession({ live })` never pushes full-body replacements into a bound editor.
- `NoteHeader` shows live peers from the session (falling back to `membersStore.presence`) and the
  `note-header-live` badge with connecting, offline, full, unavailable, and view-only states.
- Remote cursor, selection, and name label styling (`.cm-ySelection*`) lives in `src/styles/statusbar.css`;
  colors come from awareness (`collabUserColor`).

## Databases

- `features/databases/` hosts the database view tab (`DATABASE_VIEW_ID`, `viewState.filePath` is the
  folder). Open it with `openDatabaseView`, which reuses an existing tab for the same folder.
- Query and view logic come from `@cortex/properties/database`; state and writes come from the core
  database store and actions. Components must not parse YAML or write notes directly.
- The table virtualizes group headers and rows in one list. Cells reuse `PropertyValueDisplay` and
  `PropertyValueEditor`; read-only property types render without an editor.
- The peek pane is a docked `Sheet` portaled into `.db-peek-slot`; it uses `useNoteDocumentSession` with `isActive: false`, so it never becomes the active
  editor. Shared editor helpers live in `split-view/noteEditorAssets.ts`.
- Database visuals follow the design canvas (`next-db.css`): styles live in the lazily loaded
  `features/databases/database.css`, which is unlayered so it overrides `@cortex/ui` utility
  classes on the same elements. Select values render as `StatusBadge` from `@cortex/ui` (also used by `PropertyOptionValue`), people as `DatabaseAvatar`,
  dates as relative labels (`DatabaseValue`). Grids that hold `overflow: hidden` cards need
  `grid-auto-rows: max-content`, and editable titles size through the `.db-autosize` mirror.
- Menu items that start inline creation or open a dialog run after the dropdown closes
  (`onCloseAutoFocus`), otherwise Radix focus management cancels the inline input.

## Testing

Tests live in `src/__tests__/` (Vitest + jsdom, Testing Library, jest-dom). Run targeted files from
`apps/desktop`: `npx vitest run src/__tests__/features/sync/SyncIndicator.test.tsx`.

- `src/__tests__/setup.ts` stubs `ResizeObserver`/scroll APIs and mocks `@cortex/platform`
  (`getPlatform`). Override per test with `vi.mocked(getPlatform).mockReturnValue(...)`.
- Mock `@cortex/core` stores with `vi.mock`; selector-based stores need `mockImplementation` that
  applies the selector. Mock heavy child components with `vi.mock(path, () => ({ X: () => null }))`.
- Call `cleanup()` and `vi.clearAllMocks()` in `afterEach`.

## History and Recovery Dialogs

- Sync logs (`SyncLogsModal`), Deleted notes (`DeletedNotesPanel`) and Version history
  (`NoteHistoryPanel`) share `features/sync/HistoryDialogParts.tsx`: the `history-dialog` shell
  (rail + pane, Radix autofocus disabled), head with close, day groups, empty/error states, the
  rendered note preview (`ReadingView`) and the folded diff (`HistoryDiff` over core
  `buildDiffRows`).
- Log rows come from core `buildSyncLogItems`/`groupSyncLogItems`, which turn engine messages into
  kinds, tones, paths and details and merge bursts of transfers. Conflict rows open
  `syncConflictModal` (hosted in `SyncDialogsHost`) while the conflict is still pending.
- Author and device ids resolve to names through `useSyncActorNames`; version contents and word
  deltas load through `useVersionContents(entries, loader)` (keyed by entry id) with bounded
  prefetch. "Open as copy" uses `vaultStore.createFileWithContent`.
- Version history works for every vault: `NoteHistoryPanel` merges a synthetic "Current version"
  (NoteCache or disk), core local versions (`listLocalVersions`, labeled "This device" with the
  capture reason) and, when the vault is linked, Cortex Sync versions, sorted by time. The device
  filter tabs only appear for linked vaults; a server error keeps local history visible. Restore of
  a local version uses core `restoreLocalVersion`; a server restore first calls
  `captureCurrentNoteVersion`. Restore is disabled without write access (`canWriteVaultPath`).
  The `sync.show-version-history` command is offered for any readable note
  (file tree, note header, tab menu, native menu); Share stays behind `isSyncLinked()`.

## Tasks and Reminders

- Tasks UI lives in `features/tasks`: the `tasks` sidebar view (`TasksSidebar`, rail badge via
  `TasksRailBadge`), the `tasks-today` view tab (`TodayView` with `TaskDetailPanel`), and the `tasks.add` (⌘⇧A), `tasks.open-today` (⌘⇧Y) and `view.tasks` commands. Shared
  state and actions are in `taskModel.ts`; business rules come from `@cortex/tasks` and the store
  from `@cortex/core` `useTasksStore`. The undo toast is a `createModalStore` target scoped by
  surface.
- Settings → Notifications (`features/settings/NotificationsSettings.tsx`) edits the `tasks` settings
  section and uses `TimeField` for clock times.
- Reminders are scheduled in the main process (`electron/services/reminderScheduler.ts`): one
  re-armed timer (capped at an hour, re-armed on `powerMonitor` resume), the queue persisted in
  `userData/reminders.json`, so reminders keep firing while windows are closed and the app runs.
  Delivered notifications missing from a new plan are removed (`Notification.remove`), which clears
  them on other devices once a task change syncs. Actions go to the vault window
  (`emitToVaultWindow` → `notification-activation`); without one, `taskReminderActions.ts` edits the
  note directly. macOS only shows notifications from code-signed builds.

## Workspace Chrome (Next design)

- Each pane tab row is `[Back][Forward] | [tab track + New tab] … [right sidebar toggle]`; the toggle
  only shows on the top-right split leaf (`data-split-end-pane`). Tab close and dirty markers share a
  fixed slot so hover never changes tab width; extra tabs fold into a `+N` menu.
- `RightSidebar` renders Comments (lazy, 320px wide), Outline, and Backlinks for the active note from
  `commentsStore`, `editorStore`, and `linksStore`. The tag page is the `tag` view tab (`features/tags/tagWorkspaceView.ts`).
- `SelectionToolbar` replaces the inline Markdown toolbar; `NoteFindBar` shows search highlights
  coming from the Search sidebar. Sync Logs and Deleted Notes open through `syncDialogs` so both the
  status bar and Settings can reach them.

## Comments and Mentions

- `features/comments` owns the UI: `CommentsPanel` (draft card, threads ordered by anchor position,
  collapsed resolved list, empty state), `CommentThreadCard`, `CommentMessageItem` (shadcn
  `Message`), `CommentComposer` (`InputGroupTextarea`, Enter sends, Shift+Enter breaks lines, `@`
  opens the member list), and `MentionMenu` for the editor `@` autocomplete, which reuses
  `SlashCommandMenu` with an `ItemIcon`.
- `useCommentEditorAnchors` loads the note's sidecar, pushes resolved anchors into the editor, saves
  mapped anchors 1.5s after local edits, and re-resolves by quote after external replacements.
- The selection toolbar always renders: with `editor.markdownToolbar` off it shows only a labeled
  Comment button, so commenting stays discoverable. Clicking an anchor opens the Comments panel,
  scrolls to the card, and flashes it; hovering shows a preview. Mentions in messages use
  `MentionChip` with a person card tooltip; the composer highlights `@Name` through a backdrop.
- Commands live in `commentCommands.ts`: `comments.add` (⌘⌥M, also in the selection toolbar and the
  Format menu), `comments.next`, `comments.previous`, and `view.comments`. Read-only notes show
  threads without composers or actions.
- Native comment notifications go through `notificationsApi.send`: each shown `Notification` is kept
  in a map until closed so click and reply events are not lost; clicks focus the vault window and
  emit `notification-activation`. macOS adds an inline reply field. Settings → Notifications has the
  "Mentions and comments" toggle (`tasks.mentionsEnabled`).
