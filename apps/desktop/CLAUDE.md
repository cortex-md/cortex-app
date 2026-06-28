# CLAUDE.md — apps/desktop

This file provides guidance for working with the Tauri desktop application frontend.

## Overview

`apps/desktop` is the Tauri shell + React frontend. It composes packages from `@cortex/*` into a full desktop application. The frontend is built with React 19 + TypeScript + Vite.

## Structure

```
src/
  main.tsx              # React entry, calls initPlatform(tauriAdapter)
  App.tsx               # Root shell composition and high-level app state
  bootstrap/            # Host bridges and bundled plugin registration
  components/shared/    # Cross-feature desktop helpers
  features/             # Feature modules (file explorer, split view, sync, editor, settings, etc.)
  hooks/                # Commands and app/plugin/theme/workspace/window lifecycles
  styles.css            # Design system CSS
src-tauri/              # Rust source (Tauri commands, sync engine)
```

## Native Shell and Settings

The main app and Settings use separate Tauri webview windows. `main.tsx` renders `App` by default and `SettingsWindow` when `?window=settings` is present. Components should continue calling `useUIStore().openSettings(section)` for settings routes; Marketplace opens through the desktop-owned workspace helper `openMarketplaceView(tab)`.

`SettingsModal` remains as a fallback for cases where there is no active vault or native window creation fails. Shared settings layout belongs in `SettingsContent`, not in window-specific wrappers.

Settings routes are defined centrally with navigation label, page title, description, icon, and
group. Standard pages render `SettingsPageHeader` inside the scroll area, then compose
`SettingsPage`, `SettingsSection`, `SettingsGroup`, `SettingsGroupContent`, `SettingsField`,
`SettingsList`, and `SettingsEmptyState`. Section headings stay outside grouped row surfaces.
Below the desktop breakpoint, navigation uses grouped `NativeSelect` options.

Settings and Sync feedback colors must use `status-error-*`, `status-success-*`, and
`status-warning-*`. Group surfaces use `settings-group-*`; do not introduce direct Tailwind
red/green/yellow colors or one-off card backgrounds.

Appearance settings may override only font families and font sizes. UI/editor font weights and line heights are theme CSS tokens (`--ui-font-weight`, `--ui-line-height`, `--editor-font-weight`, `--editor-line-height`) and should not be written by runtime appearance overrides.

Community theme CSS is loaded as opaque text and injected directly into the WebView. Desktop code
must not import `@cortex/theme-mobile`, parse theme selectors, require token lists, or generate
`.tokens.json`.

Custom accents update `--text-on-accent`, primary/button/sidebar foregrounds, and a contrast-safe
focus color. Runtime dark styling and charts use `body[data-theme-scheme]`, never a built-in theme
class.

`tauri.conf.json` should stay platform-neutral. macOS chrome belongs in `tauri.macos.conf.json`; Windows chrome belongs in `tauri.windows.conf.json`.

Window-level native materials should come from Tauri/window effects. Do not add CSS blur to app chrome that is meant to show native vibrancy, Mica, or acrylic.

## Workspace Layout

`SplitPane` renders the recursive workspace tree and `PaneView` owns each pane's tab bar, file editor tabs, and view tabs. Tabs can contain files or declarative plugin/core views. Drag sources are tabs, file rows from `FileSidebar`, and sidebar view items. `DropZoneOverlay` covers pane content for center/edge split drops, while `TabBar` owns insertion targets for dropping before or after existing tabs.

Workspace tabs keep a fixed width with truncated titles so tab order changes do not resize neighboring tabs. Keep motion limited to subtle create, close, drag, and drop marker states.

The left sidebar's persisted width lives in `uiStore`, but live resize feedback should stay local/imperative during the drag and commit the final clamped width only on mouseup.

`SidebarViewCarousel` owns left-sidebar navigation. Core views stay ordered before extension views,
the active item expands to show its label, and `All views` provides direct searchable access through
the shared Command surface. Keep Settings outside the carousel in the fixed footer, keep each view's
scroll inside the flexible viewport, and preserve `sidebar-view` drag sources for tabs and splits.
View changes mount only the previous and current panels during the lateral transition. Plugin view
IDs are dynamic; when the active registration disappears, the host falls back to Files. Carousel
alignment must use measured viewport and button geometry and react to width changes while the active
label animates; do not return to `scrollIntoView`.

`FileSidebar` builds its hierarchy in O(n), flattens expanded rows, and virtualizes the result with
`@tanstack/react-virtual`. Keep file tree construction pure in `fileTree.ts`; row components must
subscribe only to visible row state. Tree rows are 32px inside a 36px virtual step, use 18px
indentation per level, and expose typed depth CSS properties so `--sidebar-tree-guide` can draw
continuous hierarchy guides for built-in and community themes.

The macOS shell uses a 40px overlay titlebar and an edge-to-edge native sidebar material. Traffic
light placement is owned by the Rust setup path, not `trafficLightPosition` in Tauri JSON. Keep the
sidebar flush with the window, separated only by `--sidebar-border`, and do not add CSS blur or an
inset card treatment.
macOS sidebar, titlebar, and tab bar surfaces should stay transparent so Tauri's native sidebar
window effect shows through. Native window effects are controlled by the app-wide
`appearance.nativeWindowEffects` setting, loaded by the Rust startup path and requiring relaunch
after changes. Keep the rounded border/radius treatment on the content pane only while native window
effects are enabled. Sidebar resize chrome stays invisible until hover or active resize, and titlebar
drag regions must not cover the sidebar toggle.

App-level bridges belong in `bootstrap/pluginBridges.ts`. Lifecycle effects and command wiring belong
in dedicated hooks; native menu listeners belong in `hooks/useNativeMenuEvents.ts`. `App.tsx` should
remain focused on shell composition.

## Commands and Keyboard Surfaces

`useAppCommands.ts` is the desktop-owned command catalog. Register stable app commands there once,
and read Zustand stores inside `execute(context)` instead of subscribing React components to command
state just to rebuild handlers.

Every user-facing action that should be keyboard reachable must flow through `@cortex/commands`.
Command palette, global hotkeys, Vim command-line choices, native menu events, context menus, slash
commands, toolbar buttons, and file-explorer scoped shortcuts should execute command ids through
`executeCommand(...)` or `commandRegistry.execute(...)`. Do not call Markdown/table command
functions directly from desktop UI surfaces; route through the existing `format.*`, `table.*`, and
`editor.*` command entries.

Bookmark toggles use the `bookmarks.toggle` command from note headers, file menus, hotkeys, and the
palette. Desktop UI may pass an explicit `{ filePath }` payload; otherwise the command resolves the
active editor file.

`@cortex/hotkeys` stores bindings and overrides only. Desktop mirrors command `hotkey` metadata into
that store through `bootstrap/commandHotkeyBridge.ts`; do not add a second default hotkey list in
desktop features.

Cortex Cloud billing redirects are runtime-only deep links. The app opens the configured billing
URL, the site completes checkout, and only an already-running desktop app handles
`cortex://sync/checkout-complete`. The hook must force-refresh subscription status before opening
any welcome UI; do not add desktop checkout creation or cold-start welcome handling.

## Marketplace

Marketplace UI lives under `features/marketplace/` as a first-class workspace view. The sidebar entry, commands, and buttons that browse community plugins or themes should open it through `openMarketplaceView(tab)` in the main window, which reuses and activates the existing Marketplace view tab instead of routing through Settings.

Marketplace uses a split catalog/detail workspace layout on desktop and a list/detail replacement flow on narrow screens, including README, compatibility, install/update/uninstall actions, and a back button in the narrow detail view.

Marketplace plugin install and compatibility flows use native Tauri downloads for GitHub release assets (`download_file` and `download_text`) so browser CORS/redirect behavior does not affect release-hosted `manifest.json`, `main.js`, or `styles.css`.

## Testing

Tests live in `src/__tests__/`. Run with:

```bash
bun run --cwd apps/desktop vitest run
# or from the monorepo root:
bun run test
```

### Test Stack

| Tool | Purpose |
|------|---------|
| `vitest` | Test runner with jsdom environment |
| `@testing-library/react` | Component mounting and querying |
| `@testing-library/user-event` | User interaction simulation |
| `@testing-library/jest-dom` | DOM matchers (`toBeInTheDocument`, etc.) |

### Test File Layout

```
src/__tests__/
  setup.ts                      # Global mocks (@cortex/platform, Tauri APIs, jest-dom)
  features/sync/
    SyncIndicator.test.tsx
    ConflictBanner.test.tsx
  hooks/
    useSyncLifecycle.test.tsx
```

### Mocking Zustand Stores

All `@cortex/core` stores must be mocked at the top of test files:

```tsx
vi.mock("@cortex/core", () => ({
  useSyncStore: vi.fn(),
  useAuthStore: vi.fn(),
  useVaultStore: vi.fn(),
  // ...
}))

import { useSyncStore } from "@cortex/core"

// In beforeEach or per-test:
vi.mocked(useSyncStore).mockReturnValue({
  engineState: "live",
  syncingFiles: {},
  // ...
} as never)
```

For stores that use selector functions (like `useAuthStore`), mock with `mockImplementation`:

```tsx
vi.mocked(useAuthStore).mockImplementation((selector?: (s: unknown) => unknown) => {
  const state = { authenticated: true, selfHosted: false }
  return selector ? selector(state) : state
})
```

### Mocking Child Components

To avoid rendering complex dependencies in component tests:

```tsx
vi.mock("../../../features/sync/SyncLogsModal", () => ({
  SyncLogsModal: () => null,
}))
```

### Setup File

`src/__tests__/setup.ts` is loaded before every test (via `vitest.config.ts`). It:
- Imports `@testing-library/jest-dom` to add DOM matchers
- Mocks `@cortex/platform`
- Mocks `@tauri-apps/api/core` and `@tauri-apps/api/event`

### Platform Mocks

`@cortex/platform` and Tauri APIs are mocked in setup.ts. If a specific test needs fine-grained control, override the mock in the test file itself using `vi.mock` (which is hoisted to the top of the module).

### Cleanup

Always call `cleanup()` in `afterEach` to unmount components between tests:

```tsx
import { cleanup } from "@testing-library/react"

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
```
