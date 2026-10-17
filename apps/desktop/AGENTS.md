# apps/desktop

Electron app: a TypeScript main process (`electron/`) plus a React 19 + Vite renderer (`src/`) that
composes the `@cortex/*` packages. Read the root `AGENTS.md` first.

## Layout

```
electron/            main process: main.ts, window(s).ts, preload.ts, security.ts, protocols.ts,
                     contract.ts (MainApi/MainEvents), ipc/register.ts, menu.ts, services/
src/main.tsx         initRenderer() then mounts App
src/App.tsx          initializeDesktopHost() + shell composition only
src/bootstrap/       desktopHost, pluginHost, appCommands, commandHotkeyBridge, coreContributions
src/features/        feature modules (file explorer, split view, settings, sync, marketplace, …)
src/platform/        electron-platform.ts: the @cortex/platform adapter
src/styles/          index.css imports theme.css, base.css, then one partial per surface
src/utils/           context-menu, createModalStore, modals, format helpers
```

Validate desktop changes with the root gate (`check`, `typecheck`, `check:boundaries`, `test`) and
`bun run doctor` for React changes. Packaging: `bun run --cwd apps/desktop dist`.

## Main Process and Security

- Windows run with `contextIsolation`, `sandbox`, no `nodeIntegration`. New windows and untrusted
  navigation are denied; external URLs go through `assertExternalUrl` (http, https, mailto).
- IPC is one channel: `contract.ts` declares `MainApi`, `ipc/register.ts` implements it, and every
  call passes `assertTrustedSender`. The renderer reaches main only through `electronPlatform`
  behind `getPlatform()`; UI code never touches `window.cortex`.
- Adding a command: extend the `@cortex/platform` interface and `MainApi`, implement it in
  `electron/services/`, wire it in `electronPlatform`. Events use `emitToRenderer` with a typed
  `MainEvents` name.
- File services resolve paths through `assertAllowedPath` (user data, temp, registered vaults,
  dialog grants). The credentials file is never readable from the renderer.
- Services keep IO in main but call the pure rules from `@cortex/platform/{vault,utils,hash}`.
- Only runtime-loaded packages go in `dependencies` (`adm-zip`, `electron-updater`, `font-list`,
  `write-file-atomic`); everything else is a `devDependency` so electron-builder does not pack it.
- Sync runs in a `utilityProcess` worker (`electron/syncWorker.ts` over `@cortex/sync-engine`) owned by
  `services/syncBridge.ts`. Auth, tokens, account keys, the VEK, collab keys, and server HTTP stay
  in main (`services/serverApi.ts`, `services/collab.ts`); the renderer never sees secrets.
- Each main window owns at most one vault (`window.claimVault`); events route only to the owning or
  focused window. `bun run --cwd apps/desktop dev:profile <name>` runs a second isolated profile.
- Native materials: macOS vibrancy and Windows Mica through `BrowserWindow` options, gated by
  `appearance.nativeWindowEffects`. Never layer CSS blur over native materials or dialog overlays.
  The start screen (no vault open) never shows the material: `.app-shell` reports
  `data-native-window-effects="disabled"` until a vault opens, so it paints an opaque background
  and text never sits on a native material that disagrees with the theme scheme.

## Renderer Rules

- `App` subscribes only to `hasVault`, window effects, and the workspace mode; lifecycle hooks live in the null-rendering
  `AppLifecycle`, and each shell piece subscribes to its own slice.
- Rarely used surfaces (Settings, Auth, template dialogs, history, Marketplace, database pages,
  diff views) are lazy and mount on first open. Overlays preload at idle so the first open never
  suspends. Dialog content renders only while open (`ModalHost` / `ModalStoreHost`).
- Global modal targets use `createModalStore<T>()` with one mounted host; app-level modal stores
  live in `utils/modals.ts`. `uiStore` keeps layout state only.
- Drag interactions (sidebar width, splits) update the DOM imperatively and commit once on release.
- Shared helpers live once: `utils/format.ts` and `src/hooks` (`useDebouncedCallback`,
  `useCopyFeedback`, `useCommandHotkey`, `useMinuteNow`). Do not add parallel copies.
- Heavy renderers (drawing, Mermaid, diff/shiki) stay in desktop lazy chunks; `shiki` is aliased to
  a small grammar bundle.
- Each pane keeps CodeMirror mounted for the active file tab plus 3 recent inactive ones.

## Commands, Menus, and Hotkeys

- `bootstrap/appCommands.ts` is the desktop command catalog; editor/table commands come from
  `@cortex/editor/editor-command-entries` and file commands from core `createFileCommandEntries`.
  Read stores inside `execute(context)`; report errors with core `reportAppError`.
- Every keyboard-reachable action (palette, hotkeys, Vim, native menu, context menus, slash menu,
  toolbar) executes a command id; targets travel in `context.payload`.
- Context menus are `MenuItem[]` built at open time with `commandMenuItem` and shown through
  `useContextMenu()` (one native menu, Radix fallback). Never write separate native and Radix copies.
- The native menu (`electron/menu.ts`) is declared by command id. `windows/useNativeMenuState.ts`
  sends commands only when the registry/hotkeys change and a small checked/enabled snapshot behind a
  signature guard; main mutates items in place. Add new entries as registry commands first.
- Core sidebar views, tab views, and status bar items register in `bootstrap/coreContributions.tsx`
  with owner `"core"`; plugins use the same contribution store.

## Plugins and Marketplace

- `features/plugins/` renders plugin contributions. View logic lives in `@cortex/plugin-host-core`
  `createPluginViewController`; the renderer maps descriptor nodes to components only. Never add
  `props`, `className`, inline styles, React components, or DOM handlers to plugin descriptors.
- Community plugins are gated by `settings.plugins.allowCommunity` (restricted mode, enforced by the
  host); enabling one confirms its permissions through `@cortex/marketplace`.
- Marketplace is a workspace view (`openMarketplaceView(tab)`), never a Settings section. Settings
  actions that leave Settings go through `runSettingsAction`, which closes the overlay first.
- Extension config sync is wired in `features/extensions/extensionSync.ts`.

## Search and Command Surfaces

- Search runs in a Web Worker (`features/search/searchWorker*`); MiniSearch, index parse, and snippet
  building never run on the renderer main thread. The worker has no IPC; the renderer reads files.
- The Quick Finder keeps previous results until the current query answers (latest wins) and its
  preview is plain text, never the Markdown pipeline.
- Palette and finder share `styles/command-surfaces.css`. The palette's empty state shows only
  Recent and Suggested, so opening it never renders the whole registry.

## Settings

- Settings is a lazy overlay in the main window; open it with `openSettings(section, fieldId)`.
- Pages compose the `Settings*` primitives; field labels come from `SETTINGS_FIELDS` via `fieldId`
  (which also drives search and reveal). Feedback colors use `status-*` tokens.
- Settings pages read vault files through `useSettingsVaultFiles` / `useSettingsVaultFolders`
  (vault index, no rescans).
- Appearance overrides only font families and sizes; community theme CSS is injected as opaque text.

## Workspace Layout

- `SidebarRail` (the "ribbon", 52px, 36px pill buttons, no press scale) lists core then plugin views,
  then Templates, Marketplace, Settings. `appearance.showRibbon` hides it (`features/sidebar/ribbon.ts`):
  the rail is not mounted, `SidebarViewStrip` switches views, a Settings button sits beside the
  vault switcher, and a collapsed sidebar is 0px wide. Minimum widths come from core
  `getLeftSidebarMinWidth(showRibbon)` (200px with the ribbon, 160px without). While dragging the
  resizer the sidebar carries `data-resizing`, which disables width transitions so the edge tracks
  the pointer.
- Writing mode is `appearance.workspaceMode: "writing"` (global setting; `view.toggle-writing-mode`,
  ⌘., View → Writing Mode, Settings → Appearance; helpers in `features/workspace-mode/`). The shell
  carries `data-workspace-mode` and `styles/writing-mode.css` hides chrome without unmounting
  anything; the editor drops line numbers and turns on typewriter scrolling through
  `createEditorConfig`. The properties panel stays collapsed to a one-line summary in that mode.
  `WritingModeToolbar` (top-right, mounted only in that mode) keeps Quick Finder, the command
  palette, Settings, and exit one click away for people who do not know the shortcuts; every button
  executes a registry command.
  The first vault open asks once (`WorkspaceModePrompt`, lazy) and records the answer in the app
  onboarding marker.
- `FileSidebar` virtualizes rows projected from the core vault index (`useVaultFileTree`); never
  rebuild the tree from `files`. Rows are 32px; notes have no icon, folders only a chevron,
  databases a `DatabaseViewTile`, other files a muted kind glyph (`fileKindIcon.tsx`). The tree focus
  ring shows only during keyboard navigation.
- The window ground is the sidebar material; each pane is a floating card; tab and status bars are
  transparent. On macOS, reserve traffic-light/toggle space only on the leading split leaf tab bar
  (`data-left-sidebar-collapsed`, `data-split-start-pane`); never push the whole workspace down.
- Add CSS to the partial that owns the surface; `macos.css` loads lazily on macOS only.

## Domain Notes

- Databases: query/view logic from `@cortex/properties/database`, state and writes from core; UI
  never parses YAML or writes notes. Styles live in the lazy, unlayered `database.css`.
- Templates are managed in workspace tabs, not Settings; `templates.create-note` has no default
  hotkey because ⌘⇧N is `window.new`.
- Reminders are scheduled in main (`services/reminderScheduler.ts`) so they fire with windows
  closed. Notifications always go through `getPlatform().notifications`.
- Live collaboration: a viewer binding is read-only; `useNoteDocumentSession({ live })` never pushes
  full-body replacements into a bound editor.
- Version history merges local history and server versions; restore requires write access.

## Testing

- Vitest + jsdom + Testing Library under `src/__tests__/`; `setup.ts` mocks `@cortex/platform`.
- Mock stores with `vi.mock` (selector stores need a selector-applying `mockImplementation`), mock
  heavy children, and `cleanup()` / `vi.clearAllMocks()` in `afterEach`.
- Benchmarks and profiling live only in `tools/benchmarks/` and drive the built app from outside.
