# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**Cortex** is a modular markdown platform with desktop app and developer tooling. The architecture is a monorepo using bun workspaces, with clear separation between:
- **apps/cli** — Official Cortex CLI (Go) for plugin/theme create, validate, and publish workflows
- **apps/desktop** — The Electron application entry point
- **packages/** — Reusable modules (ui, core, platform, theme, editor, settings, sync-api, sync-engine)

## Package responsibilities

```
cortex/
├── apps/
│   ├── desktop/                    # App Electron (main/preload TypeScript + React/Vite renderer)
│   │   ├── electron/               # Main process: IPC, native services, menus, protocols
│   │   │   ├── main.ts             # Electron entry: single-instance, deep links, window lifecycle
│   │   │   ├── preload.ts          # contextBridge window.cortex.invoke/on
│   │   │   ├── contract.ts         # MainApi/MainEvents: typed IPC contract shared with the renderer
│   │   │   ├── ipc/register.ts     # MainApi object → single typed invoke handler
│   │   │   ├── menu.ts             # macOS/Windows application menu + dock recents
│   │   │   ├── protocols.ts        # cortex-file:// asset protocol
│   │   │   └── services/           # FS, vault, registry, watcher, auth, keychain, sync host, …
│   │   ├── electron.vite.config.ts
│   │   ├── electron-builder.yml
│   │   └── src/                    # React renderer — composição dos packages
│   │       ├── main.tsx            # initPlatform(electronPlatform), monta React app
│   │       └── App.tsx             # Composição de layout, providers, workspace
│   └── mobile/                     # Expo/React Native app — consome packages/core e packages/platform
│       └── src/                    # app/ (thin routes), bootstrap/, hooks/, features/, components/ui/, platform/
├── packages/
│   ├── core/                       # Lógica pura: vault, metadata, eventos, Note Cache, índice; usa a abstração de plataforma.
│   ├── commands/                   # Registry agnóstico de comandos, hotkeys associadas e nomes Vim
│   ├── editor/                     # Motor de edição: CodeMirror 6 + extensões Markdown + Live Preview
│   ├── ui/                         # Componentes React compartilhados, design system
│   ├── plugin-api/                 # Contratos públicos que plugins podem importar
│   ├── platform/                   # Abstração de plataforma: adapters para Electron e RN
│   ├── settings/                   # Engine de configurações, cache em memória, persistência
│   ├── templates/                  # Linguagem segura e renderização de templates de notas
│   ├── search/                     # MiniSearch: indexação, serialização, queries
│   ├── theme/                      # Engine de temas e variáveis CSS para superfícies web
│   ├── sync-api/                   # Fetch-only Cortex server client shared by desktop main, mobile, web
│   ├── sync-engine/                # Sync engine Node (UtilityProcess): sync.db, SSE, queue, merge
├── plugins/                        # @cortex/plugins: bundled definePlugin modules
│   ├── index.ts                    # bundledPlugins list (one line per plugin)
│   └── github-emoji/               # index.ts + data
├── bun.lockb
└── bunfig.toml
```

## Code Conventions


### UI components 
Always use the components from `@cortex/ui` as needed instead of creating new things or using primitive components from html.
Primary actions use the accent-backed default `Button`; neutral actions select `secondary`, `outline`,
or `ghost` explicitly. Icon search fields use `InputGroup variant="search"` with `InputGroupAddon`
and `InputGroupInput` instead of locally positioning icons around `Input`.
Inputs default to the comfortable 32px form size; inline rename and dense controls use `size="sm"`.

### Command Surfaces
Use `CommandDialog`, `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem`, and
`CommandShortcut` from `@cortex/ui` for command palettes, quick finders, tag pickers, and similar
keyboard-first modal search surfaces. These surfaces are styled through `[data-command-surface]`
in `apps/desktop/src/styles.css`; keep selection states subtle and token-driven, preserve
`cursor: default`, use `cmdk` loop navigation for arrow keys, prefer item-level actions, and use
`CommandFooter`, `CommandFooterHint`, and `CommandFooterKey` only for concise global keyboard hints
such as navigation, open, create, and dismiss.

### Commands, Hotkeys, and Vim
All app and plugin commands must be registered through `@cortex/commands`. A command's palette
entry, configurable hotkey, and Vim command-line name should be described in the same
`CommandEntry`. Desktop bridges command hotkeys into `@cortex/hotkeys`; editor-scoped command
hotkeys are reconfigured into CodeMirror; Vim mode reads the same registry only while Vim is
enabled. Use `CommandExecutionContext.payload` for explicit menu/context targets. Do not add
separate command lists for the palette, hotkeys, native menus, context menus, or Vim.
Context menus (editor, file tree, note header, tabs) are `MenuItem[]` lists built at open time from
`commandMenuItem(commandId, { text, payload })` in `apps/desktop/src/utils/context-menu.ts`: the
command supplies the action, icon, and the user's effective hotkey (shown with
`formatHotkeyDisplay`), `getPluginMenuItems` merges plugin `contextMenuItems`, and
`useContextMenu()` renders the list through the single native menu instance or a Radix fallback.
Shared builders live in `features/file-explorer/fileMenu.ts` and `features/split-view/tabMenu.ts`;
file actions such as open in split, duplicate, delete, copy path, reveal, export, and version
history are payload commands (`{ filePath }`) registered in `bootstrap/appCommands.ts`.
Desktop Markdown controls such as slash commands and the optional formatting toolbar should execute
the existing `format.*` `CommandEntry` objects from the registry instead of importing Markdown
command functions directly.

### React Performance
Hoist static arrays, objects, and pure helpers out of React components when they do not read props,
state, or render-local bindings. Settings pages often pass actions and option lists into reusable
sections, so module-scope bindings keep those props stable and avoid per-render allocations.
When two awaited calls in frontend or core code do not depend on each other's result and have no
ordering constraint, run them with `Promise.all` to avoid sequential latency.
Initialize React state synchronously with lazy `useState` when the initial value is available during
render. For viewport or other external browser state, prefer `useSyncExternalStore`; for DOM
measurements that only drive styling, update CSS variables directly instead of triggering React
renders.
When an effect subscribes to DOM, platform, or store events and only needs the latest callback inside
the event handler, wrap that callback with `useEffectEvent` instead of adding it to the effect
dependencies and re-subscribing.
Do not call `renderSomething()` helpers from JSX when they return UI. Extract a named component and
render it as JSX so React can preserve state and show it in DevTools.
Keep the desktop root render-cheap: `App` subscribes only to `hasVault` and the window-effects flag;
lifecycle hooks live in the null-rendering `AppLifecycle`, and each shell piece (`AppTitlebar`,
`SidebarShell`, `WorkspaceShell`, `AppOverlays`) subscribes to its own slice. Rarely used surfaces
(Settings, Auth, New note from template, New template, Share template, note history, Marketplace
view, Templates and template editor tabs, New database page, diff views,
vault link, date property editor) are `React.lazy` and mount only after first open (`useHasOpened`).
Drag interactions (sidebar width, split sizes) update the DOM imperatively and commit to the store
once on pointer release.
Desktop shared helpers live in one place: formatting (`getInitials`, dates, `formatBytes`,
`pluralize`, `toggleSetItem`) in `apps/desktop/src/utils/format.ts`; `useDebouncedCallback`,
`useCopyFeedback`, `useWatchedDirectory`, and `useCommandHotkey` in `apps/desktop/src/hooks`.
Global modal targets use `createModalStore<T>()` (`utils/createModalStore.ts`) with one mounted host.
Bookmarks, Tags, and Search sidebars compose `SidebarToolView` from `features/sidebar`.
For commit-on-blur text fields, prefer an uncontrolled input with `defaultValue`, a `key` tied to
the external value, and an `onBlur` commit. Do not mirror the prop into local state with
`useEffect`.
For command surfaces that need the current highlighted item only inside keyboard handlers, keep the
highlighted value in a ref or derive it from current items. Avoid syncing it from the item list into
React state with an effect.

### React Doctor
After React-facing code changes, use the `react-doctor` skill and fix diagnostics introduced by
what you changed.

### Instruction Files and Skills
Keep Codex-facing repository guidance in `AGENTS.md`. Use `CLAUDE.md` as a compatibility pointer or
Claude-specific package guide, not as a second copy of the same manual. Create project skills under
`.codex/skills` only for recurring, non-obvious workflows that should load on demand; keep
`SKILL.md` concise and validate it with the `skill-creator` tooling.

### No Comments
Code is self-documenting through descriptive naming. Function names, variable names, and type names
should clearly express intent. Add comments only for non-obvious constraints that naming cannot make
clear.

### Self-Documenting Code Standards
- **Function names**: Use clear, descriptive verbs: `openVault`, `refreshFiles`, `flushActive`
- **Variable names**: Avoid abbreviations; prefer `activeFilePath` over `activeFile` or `path`
- **Type names**: Use PascalCase for interfaces/types: `EditorState`, `FileEntry`, `VaultMetadata`
- **Constants**: UPPER_SNAKE_CASE for compile-time constants, lowercase for module-scoped constants
- **Event handlers**: Prefix with action verb: `handleOpenVault`, `handleResize`, `updateCursor`
- **AGENTS.md**: Always update the AGENTS.md files from the packages you have made changes, to keep the documentation alive.

### Formatting & Linting
- **Biome** enforces all code style (see `biome.json`)
- **Indentation**: Tabs (not spaces)
- **Line width**: 100 characters
- **Quotes**: Double quotes
- **Semicolons**: Not used (Biome removes them)
- **Import organization**: Automatic via Biome (`organizeImports: "on"`)

Run `bun run check` for the desktop quality gate: Biome lint, format, and import checks on
`apps/desktop`, every package under `packages/`, `plugins/`, `scripts/`, and `tools/`. Use
`bun run check:fix` to auto-fix that same scope. Mobile and web keep their own `check:*` scripts.

### Type-First Approach
Always define types/interfaces before implementation. Props interfaces extend HTML attributes for consistency:

```typescript
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary"
  size?: "sm" | "md" | "lg"
  children: ReactNode
}
```

## Building & Development

### Core Commands

```bash
bun install                # Install dependencies
bun run dev:desktop       # Start Electron + Vite
bun run dev:mobile        # Start Expo for apps/mobile
bun run build             # Production desktop bundles in apps/desktop/out
bun run check             # Biome lint + format + organize imports (desktop scope)
bun run check:fix         # Auto-fix the same Biome scope
bun run check:boundaries  # Validate workspace dependencies, layers, and cycles
bun run typecheck         # TypeScript for desktop, its packages, and tools/benchmarks
bun run typecheck:all     # TypeScript across the full monorepo
bun run test              # Every desktop-scoped Vitest project in one run (root vitest.config.ts)
bun run test:watch        # Same projects in watch mode; filter with --project <name>
bun run test:coverage     # Same projects with V8 coverage
bun run check:mobile      # Mobile lint + typecheck
bun run test:mobile       # Mobile deterministic gate
bun run check:web         # apps/web Biome check
bun run test:web          # apps/web tests
bun run doctor            # React Doctor changed-scope scan for apps/desktop
bun run doctor:mobile     # React Doctor changed-scope scan for apps/mobile
bun run bench             # Micro benchmarks in tools/benchmarks (vitest bench)
bun run bench:large-vault # Large-vault workbench (file tree, search, renderer)
bun run perf              # Real-app budgets from the roadmap (needs `bun run build`)
bun run perf:monitor      # Live FPS, long tasks, JS heap, RAM, and CPU of the built app
```

GitHub Actions are desktop-scoped by default while mobile is in active development. `ci.yml` runs
Biome, TypeScript, workspace boundaries, and every desktop Vitest project; it ignores changes that
only touch `apps/mobile`, `apps/web`, or `docs`. `release.yml` calls `ci.yml` as a reusable workflow
before packaging, so a release never builds from a red commit. React Doctor runs on pull requests.
`perf.yml` runs the smoke budgets on every push to `main` (manual dispatch picks the roadmap scale)
and keeps the JSON as an artifact; the plugin API publish workflow is manual-only. Mobile and web checks stay
available through explicit scripts but do not block default CI.

### Running the App
```bash
cd apps/desktop
bun run dev               # Launch Electron window with hot reload
bun run dist              # Build + package release binaries
```

### Monorepo & Workspaces
- Packages use workspace protocol: `"@cortex/core": "workspace:*"`
- Packages are imported as source TS, not built intermediates
- Vite handles tree-shaking at build time
- Each package has its own `tsconfig.json` and `package.json`

## Project Structure

### packages/

| Package | Purpose | Key Exports |
|---------|---------|------------|
| **ui** | React UI primitives (Button, Input, Command, etc.) | Component functions, CSS class contracts |
| **core** | Zustand state stores + NoteCache | Stores (vaultStore, editorStore, workspaceStore, uiStore), noteCache |
| **commands** | Platform-agnostic command registry | CommandRegistry, CommandEntry, Vim-safe name helpers |
| **properties** | Framework-free note property engine | Schemas, YAML codecs, validation, suggestions, system metadata, CM6 extension |
| **platform** | Abstract platform interface | FileSystem, Dialog, Vault, Storage interfaces + Electron/RN adapters |
| **sync-api** | Fetch-only server client | ApiClient, AuthSession, mappers, createServerApiServices |
| **collab** | Portable E2EE real-time collaboration (Yjs) | `./wire`: frames, control messages, collab key + AES-GCM envelope |
| **sync-engine** | Desktop sync worker | SyncDb, SSE, queue, merge, UtilityProcess entry |
| **editor** | CodeMirror 6 setup | EditorView, extensions, syntax highlighting |
| **theme** | CSS theme system | ThemeManager, CSS variable generation, paper/ink themes |
| **settings** | App settings management | SettingsManager, Zod validation, persisted via JSON |
| **templates** | Safe note template language | Template manifests, placeholder rendering, formula filters |

### apps/desktop/

- **src/main.tsx** — React entry, initializes ThemeManager, sets up platform
- **src/App.tsx** — Root component, orchestrates stores and layout
- **src/features/** — Desktop feature modules, including file explorer, split view, settings, sync,
  and marketplace UI
- **src/components/shared/** — Cross-feature desktop helpers only
- **src/styles.css** — Design system CSS (primitives, layout, components)
- **electron/** — Electron main/preload (IPC handlers, native services, menus)


## Architecture Patterns

### State Management: Zustand + Immer
Stores use Zustand with Immer middleware for immutable updates:

```typescript
export const useMyStore = create<MyState>()(
  devtools(
    immer((set, get) => ({
      // initial state
      value: 0,

      // actions mutate within immer
      increment: () => set((s) => {
        s.value++
      }),

      // async can use get()
      asyncAction: async () => {
        const current = get().value
        // ...
      }
    })),
    { name: "myStore" }
  )
)
```

### UI Components: Primitives Only
All components in **packages/ui** are pure primitives:
- Apply CSS class names (never inline styles)
- Extend HTML element attributes (`ButtonHTMLAttributes`, `InputHTMLAttributes`, etc.)
- No business logic, no store dependencies
- Reusable across desktop app and future web landing page

Example (Button.tsx):
```typescript
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "accent" | "danger"
  size?: "sm" | "md" | "lg"
  children: ReactNode
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`btn btn-${size} btn-${variant} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
```

### Platform Abstraction
Native commands are abstracted behind `@cortex/platform` interfaces. Desktop code never directly imports from IPC; it uses platform methods:

```typescript
// ✅ DO
const platform = getPlatform()
const files = await platform.vault.scanVault(path)

// ❌ DON'T
import { main } from "../platform/electron-platform"
const files = await main.vault.scanVault(path)
```

The desktop adapter (`apps/desktop/src/platform/electron-platform.ts`) bridges to `window.cortex.invoke/on`. Mobile's `apps/mobile/src/platform/expo-platform.ts` assembles one Expo module per platform domain (`fs.ts`, `vault.ts`, `dialog.ts`, …), following the desktop `electron/services` pattern.

### NoteCache: Cache-First File Handling
The `NoteCache` class (in `@cortex/core`) manages editor file state:
- **In-memory cache** of file contents and diffs
- **Auto-save** with 2-second debounce
- **Snapshots** for undo/redo
- **Property metadata** is initialized and refreshed through `@cortex/properties` before saves
- **Lifecycle**: `noteCache.openTab()` on file open, `noteCache.closeTab()` on close

UI doesn't directly access files; it reads/writes through noteCache.

### New Vault Onboarding
New-vault onboarding note content and first-run/vault marker rules live in `@cortex/core`, under
`packages/core/src/onboarding`. The visible welcome note is normal vault Markdown; app-level and
vault-level markers are stored through `@cortex/platform` storage paths, not Electron-specific APIs.
Desktop owns only the presentation flow and opening `pendingOnboardingNotePath` after workspace
restore.

### Theme System: Injected CSS Variables
`@cortex/theme` owns theme tokens and generates CSS variables:
- `initThemeManager("ink")` called before React render
- Injects `<style data-theme="ink">` with all variables as hex values
- Supports runtime theme switching via `setActiveTheme("paper")`
- Typography defaults are theme tokens. UI and editor font families default to the OS system font
  stack; Settings may override only `--font-ui`, `--font-editor`, `--ui-font-size`, and
  `--editor-font-size`. Font weights and line heights stay theme-owned through
  `--ui-font-weight`, `--ui-line-height`, `--editor-font-weight`, and `--editor-line-height`.
- Markdown surfaces share `--markdown-content-width`, `--markdown-content-gutter`,
  `--markdown-block-radius`, `--markdown-block-spacing`, `--markdown-code-padding-inline`,
  `--markdown-code-padding-block`, and the `--markdown-callout-padding-*` variables. Live Preview,
  Reading View, and Side-by-Side must keep these aligned. These values and built-in callout colors
  live in `ThemeTokens.markdown`. Heading colors are theme-owned through `--h1-color` through
  `--h6-color`, falling back to `--syntax-heading` for existing community themes.
- Built-in heading scale and inline note title spacing live in `ThemeTokens.heading`, exposed through
  `--h1-font-size` through `--h6-font-size` and `--inline-title-margin-bottom`. Community themes keep
  their own heading values.
- Markdown code spans and fenced code blocks use `--font-editor` and the editor font size. Keep
  smaller typography only for code block chrome such as language badges and copy buttons.
- Editor selection and CodeMirror search matches use `--editor-selection-bg`,
  `--editor-search-match-bg`, and `--editor-search-match-active-bg`. Built-in themes define these
  through `ThemeTokens.semantic.selection`; community themes may override the CSS variables.
- Callout definitions are shared by Live Preview and the renderer through `@cortex/renderer`.
  Plugins register or override callout types with `contributes.markdown.callouts`; later
  registrations win and disposing restores the previous definition. Keep standard aliases intact,
  use `--callout-<type>-color` and `--callout-<type>-bg` for theme defaults, and let explicit plugin
  colors take precedence.
- `@cortex/properties` owns structured YAML frontmatter parsing, property schemas, note property
  mutations, body projection helpers, and the metadata-only CodeMirror extension.
- Properties runtime access is split into `files`, `notes`, `identity`, and `metadata` services.
  Desktop panels load one `NotePropertiesSnapshot`; future mobile adapters reuse factories, value
  parsing, actor resolution, schema storage, and note operations without importing React DOM code.
- Desktop property UI stays decomposed into the panel controller, rows, value editors, inspectors,
  and Add Property discovery. Draft editors must deduplicate Enter, blur, and popover dismissal.
- `select` is the only built-in colored option type. Legacy unavailable property types remain
  preserved and read-only; do not reinterpret them during schema loads.
- System note metadata resolves through injected filesystem and sync snapshots. Creation fields and
  IDs are write-once, while last-edited fields follow the actor and timestamp of the active source.
  Member and device labels are presentation data and must not replace stored IDs.
  `@cortex/renderer` owns rendered Markdown semantics and strips frontmatter without rendering a
  duplicate properties card.
- Note editors receive only the Markdown body. NoteCache keeps the complete raw note, and desktop
  recombines body edits with the unchanged frontmatter prefix before writes. Frontmatter must never
  enter CodeMirror's document, cursor, selection, or coordinate model.
- `@cortex/editor` projects Markdown semantics into CodeMirror. It must not create a renderer,
  reparse table cells inside widgets, or reintroduce frontmatter source ranges into note editors.
- Live Preview uses one block `StateField` and one visible-range `ViewPlugin`. Document changes
  perform one block traversal; visual updates perform one viewport traversal. Selection changes
  rebuild block decorations only when a block changes source/widget mode. Do not override
  CodeMirror's default arrow-key, pointer, or cursor placement behavior for Live Preview.
- Plugins extend every Markdown surface through `contributes.markdown.inline` and
  `contributes.markdown.semantic`. Semantic output is limited to validated portable nodes;
  arbitrary DOM, HAST, CodeMirror widgets, event handlers, and inline styles are not public API.
- Semantic registrations compose by priority over portable text nodes. Inline rules are the regex
  convenience layer over the same portable-node transformation path.
- `contributes.markdown.processors` is the advanced Unified escape hatch for explicitly selected
  `reading-view` and `export` surfaces. Processors declare one `remark` or `rehype` phase, run in
  priority order on cloned trees, and always run before HTML sanitization. Live Preview-specific
  behavior belongs in semantic registrations or `contributes.editorExtensions`.
- Live Preview block state keeps ordered indexes for callouts, blockquotes, code, and replacement
  blocks. Visual passes query only visible ranges and record syntax-node, candidate-block, and
  decoration metrics; do not reintroduce full-block filters in the visible `ViewPlugin`.
- Live Preview uses `EditorView.blockWrappers` for block geometry. Tables, frontmatter, code, and
  callouts keep their source lines in CodeMirror. Table rows, images, and horizontal rules may use
  replacement decorations only within one source line. Do not replace ranges containing line
  breaks.
- Live Preview tables keep cell text mapped to CodeMirror positions and hide only Markdown pipe and
  spacing ranges. Delimiter rows keep their hyphens and alignment colons mapped but collapse to a
  one-pixel projection while rendered. Never replace a full table row. A collapsed cursor may stay
  in the rendered table grid; non-empty selections entering a table restore source mode for the
  whole table.
- Live Preview list markers are viewport-scoped inline projections from Lezer `ListMark` nodes.
  Entering a list item line restores its raw marker while task checkbox projection remains
  independent.
- CodeMirror widgets with interactive controls must consume pointer events before CodeMirror moves
  the selection. Hover and active state must be scoped to the owning widget or Markdown block.
- CodeMirror block decorations must be provided by a `StateField`; `ViewPlugin` decoration facets
  may only provide inline marks, replacements, and widgets.
- Any selection overlapping a rendered block forces source mode while the selection exists. Widgets
  may reveal source on direct pointer interaction, but they must not remap ordinary cursor movement.
- Live Preview CSS must not add vertical padding, margins, transforms, or non-baseline alignment to
  editable `.cm-line` content or inline marks. Block chrome should be painted with non-interactive
  pseudo-elements behind the line so CodeMirror's coordinate mapping remains native.
- Shared Markdown semantics belong in `packages/editor/src/markdown.css`; Live Preview-specific
  projection styles belong in `packages/editor/src/livePreview/styles.css`. Desktop CSS owns only
  Reading View, Side-by-Side, and shell layout.
- The editor Markdown language must keep the Lezer GFM extensions enabled so tables,
  strikethrough, task lists, and autolinks exist in the syntax tree used by Live Preview.
- Vim mode uses `@replit/codemirror-vim` in a reconfigurable compartment before all editor keymaps.
  Enable `drawSelection()` only with Vim mode, and theme its cursor, visual selection, and command
  panel through the existing editor and semantic CSS variables.
- In parent-scroll note editors, the Vim command-line panel must remain at the bottom of the note
  surface like Vim, not immediately after short document content.
- Community plugin `styles.css` files require `contributes.markdown` in the plugin. The runtime
  parses and scopes them to `.markdown-surface`, installs them only while the plugin is enabled,
  and rejects global at-rules.
- Community theme manifests contain identity and light/dark stylesheet paths without API
  versioning. Desktop and Marketplace treat stylesheet contents as opaque browser CSS; they do not
  parse selectors, require tokens, or reject CSS based on future mobile compatibility.
- Theme installation validates paths and assets in staging and restores the previous theme if
  promotion or reload fails. These filesystem protections remain independent from CSS parsing.
- No package parses theme CSS into portable tokens. Mobile reads `paperTheme`/`inkTheme` tokens
  from `@cortex/theme` directly. Desktop never generates `.tokens.json`.
- Theme adapters set `data-theme-scheme` from the effective scheme. Dark variants, charts, and
  platform-specific dark styling must use that attribute instead of `.theme-ink`.
- Custom accents resolve light or dark foregrounds at 4.5:1 and derive focus colors at 3:1.
  Primary, sidebar, and button foreground aliases must update together.
- Standard Settings pages use a page header in the scroll area followed by section headings outside
  `SettingsGroup` surfaces. Rows share 56px minimum height and thematic dividers. Compact layouts
  use grouped `NativeSelect`; Marketplace remains a separate full-height browser.
- Sync dialogs and recovery panels use bounded flex or grid layouts. Every nested scroll viewport
  needs `min-h-0` through its parent chain so logs, versions, diffs, and deleted notes scroll
  independently.
- Settings uses `NativeSelect` for compact option menus. Searchable file and folder controls reuse
  `FolderPicker`; inside clipped Settings groups, enable its reserved dropdown space.
- The sync overview never exposes remote vault IDs. Prefer already-loaded vault metadata, sync
  state, device state, and file lists; fetch devices only for a visible, authenticated linked
  overview when the store is empty.
- Self-host field catalogs, secret keys, ordered `.env` serialization, engine-state presentation,
  and relative sync time formatting belong to `@cortex/core`. Desktop owns keychain, clipboard,
  native export, and React settings composition.
- Self-hosted environment settings use one controlled disclosure across Server, Database,
  Authentication, and Storage. Keep secret values in the OS keychain and preserve `.env` copy and
  export behavior.
- The note header owns the editable filename title and display-only breadcrumb. It shares the note
  scroll container across Editing, Live Preview, Reading, and Side-by-Side modes. Title renames must
  go through `vaultStore.renameFile` so NoteCache, tabs, bookmarks, and filesystem state move
  together. The breadcrumb is note-relative, omits the vault and `.md`, and reveals itself through
  CSS hover only.

## Common Development Tasks

### Adding a New UI Component
1. Create in `packages/ui/src/MyComponent.tsx` as a primitive
2. Export from `packages/ui/src/index.ts`
3. Import in app: `import { MyComponent } from "@cortex/ui"`
4. Style via CSS classes in `apps/desktop/src/styles.css`

### Adding a New Store
1. Create in `packages/core/src/stores/myStore.ts`
2. Export from `packages/core/src/index.ts`
3. Use in components: `const { state, action } = useMyStore()`

### Adding a New Electron IPC Command
1. Implement the service in `apps/desktop/electron/services/`
2. Add it to `MainApi` (`apps/desktop/electron/contract.ts`) and implement it in the main service object
3. Override it in `apps/desktop/src/platform/electron-platform.ts` only if it needs callbacks or local logic

### Debugging
- **DevTools**: View → Toggle Developer Tools in unpackaged builds
- **Store inspection**: Zustand devtools shows in browser console
- **CSS issues**: Check computed styles for theme variables
- **Type errors**: Run `bun run typecheck` to catch TS issues across monorepo
- **Performance benchmarks**: Keep benchmark and profiling code in `tools/benchmarks/` only (see its
  README). It drives the built app from outside through Playwright, so nothing it injects reaches
  the desktop bundle. Expose new entry points through the root `bench`/`perf` scripts.

## Important Implementation Details

### macOS Native Sidebar
macOS window material is configured through Electron `BrowserWindow` options in
`apps/desktop/electron/window.ts` (vibrancy sidebar, trafficLightPosition). Do not layer CSS blur
over the native sidebar material. Traffic light placement uses a 40px titlebar budget with a 14px
left inset and vertical centering. The React shell uses `app-shell`, `app-titlebar`, `app-content`,
`app-sidebar`, `app-sidebar-resizer`, and `app-main` as CSS contracts for macOS-only native
layout styling. The sidebar is edge-to-edge with only a themed right divider; do not restore the
Tahoe-era inset card, inner radius, or CSS blur. The macOS sidebar toggle is rendered in the
titlebar with `app-sidebar-toggle` and drives the existing `leftSidebarCollapsed` state with
width-based native-style animation. When the sidebar is collapsed, keep the workspace vertically
flush with the titlebar and reserve horizontal traffic-light/toggle space only on the leading split
leaf tab bar via `data-left-sidebar-collapsed` and `data-split-start-pane`; do not push the whole
workspace down.
MacOS dialog overlays must not add CSS backdrop blur. Keep the backdrop visually consistent with
the active modal style while making sure modal content stacks above app chrome and editor surfaces.
Left-sidebar view navigation lives in `SidebarRail`: a vertical icon rail where core views precede
plugin views and Marketplace and Settings sit at the bottom; the active view owns the panel beside
it. Do not add CSS backdrop blur over the native sidebar material.

### Native Desktop Shell
Keep Electron main-process chrome platform-aware in `apps/desktop/electron/window.ts` and
`menu.ts`. Window-level materials should come from Electron window effects (vibrancy/Mica), not CSS
blur layered over opaque web surfaces. Main windows are one per vault (`electron/windows.ts`). Settings opens in its own on-demand BrowserWindow
(`electron/windows.ts`); it shares state with the main window only through the desktop window bridge
(`src/windows/`). Shared settings layout lives in `SettingsView`.

### Native Notifications
All app and plugin notifications must go through `getPlatform().notifications`, never DOM toasts
or browser notification APIs. Desktop delivery is implemented by the desktop platform adapter through Electron's
notification APIs; future mobile adapters should implement the same `Platform.notifications`
interface and no-op unsupported feature fields instead of throwing. Core app notifications bypass
plugin permission checks but still respect OS permission and platform support.

Plugins must declare `"notifications"` in `manifest.permissions` before calling
`ctx.notifications.send(...)` or `ctx.ui.showNotice(...)`. `@cortex/plugin-host-core` validates
unknown permissions during discovery and enforces them at call time. Plugins cannot request OS
notification permission directly; permission prompts are owned by the host app.

### Plugins
Bundled and community plugins export `definePlugin({ manifest, settings, contributes, activate,
load })` from `@cortex.md/api`. Hosts register contributions without running plugin code and
activate lazily on first use. Bundled plugins live in `plugins/<id>/` inside the single
`@cortex/plugins` package and are listed once in `plugins/index.ts`; adding one needs no tsconfig,
Biome, CI, or boundary edits. Desktop and mobile build the host with
`createPluginHost({ ...createCoreServices(), ...hostServices })`. Core desktop sidebar views, tab
views, settings pages, and status bar items register in the same contribution store with owner
`"core"` (`apps/desktop/src/bootstrap/coreContributions.tsx`); do not add parallel registries.

Community plugins follow the Obsidian model: they run in the same realm as the editor (desktop
renderer, mobile workspace WebView) with no isolation. Safety rests on opt-in, marketplace review,
and scanning. Restricted mode is the app-level setting `plugins.allowCommunity` (`@cortex/settings`,
off by default, stored in the app data `settings.json`, never in a vault). It is enforced only in
`@cortex/plugin-host-core` through `services.community.isAllowed()`; hosts wire it from the settings
store (desktop) or the mirrored workspace state (mobile) and call `syncCommunityAccess()` when it
changes. Enabling a community plugin first confirms its declared `manifest.permissions` through
`@cortex/marketplace` `getPluginEnableConfirmation`.

### Workspace Marketplace
Marketplace is a first-class desktop workspace view, not a Settings section. Community plugin/theme
browse buttons, the sidebar Marketplace entry, and app commands should call the desktop-owned
`openMarketplaceView(tab)` helper so the existing Marketplace view tab is reused, activated, and
switched between plugins/themes without adding Marketplace routing to `useUIStore` or the settings
window URL. Settings browse actions must close Settings or ask the main window to open Marketplace
instead of opening a hidden workspace tab inside the Settings window.

Community plugins and themes are vault-scoped. The desktop app loads plugins from
`<vault>/.cortex/plugins` and themes from `<vault>/.cortex/themes`; `cortex dev` (cortex-md/cli)
copies development builds into those vault directories (resolved from `--vault`, `CORTEX_VAULT`,
vault ancestor detection, or the last vault used) and marks them with a `.cortex-dev` file.
Marketplace release assets must include `manifest.json` plus the installable bundle/CSS assets as
individual GitHub Release assets, not only a ZIP archive. The CLI mirrors this contract in its
`internal/rules` package and `plugin/inspect.cjs` loader; update both when `PLUGIN_PERMISSIONS`, the
community loader, or the theme manifest schema change.
Plugins that need temporary read-only Markdown notes, such as onboarding or plugin changelogs,
should call `ctx.workspace.openMarkdownTab(...)` with the `workspace:tabs` permission. Desktop renders the
content as an ephemeral workspace tab and must not write it to the vault, `noteCache`, or
`.cortex/workspace.json`.

### Editor Setup
- `@cortex/editor` owns editable Markdown surfaces, CodeMirror runtime loading, extensions, and
  Live Preview projection.
- Production CodeMirror value imports stay behind the lazy loader in
  `packages/editor/src/runtime.ts`.
- Syntax highlighting colors resolve from CSS variables when the editor runtime mounts.

### Keyboard Shortcuts
- App commands register once at bootstrap in `apps/desktop/src/bootstrap/appCommands.ts`; editor
  and table commands come from `@cortex/editor/editor-command-entries` so mobile shares them
- Feature-local shortcuts remain in their owning component files
- Use native event handlers (`onKeyDown` checks `event.key`, `event.metaKey`)
- No library (too opinionated for this app)

### Sync Logging Architecture
Sync logs follow a **single-source-of-truth** model — the sync-engine UtilityProcess is the authority for engine events, the frontend only logs what it originates:

**Sync engine (`emit_log` → `sync-log` event)**:
- State transitions (connecting, live, offline, denied, etc.)
- Initial sync start/complete/fail
- DB errors, VEK errors, reconciliation errors
- File sync operation errors (from process_queue)
- Conflicts detected
- Vault access denied (403)

**Frontend (useSyncLogStore.getState().log() directly)**:
- Sync lifecycle start/stop decisions (useSyncLifecycle.ts)
- Vault access denied handling on JS side (auto-unlink)

**Never duplicate**: If an event originates in the sync engine, only the engine logs it. The frontend `onSyncLog` listener bridges engine logs into `syncLogStore`. Frontend code must NOT add its own log call for the same event.

**Never log tokens or secrets**. Server URLs and vault IDs are safe for debugging self-hosted setups.

### Sync File Authority

- The native watcher is the frontend authority for content that changed on disk. `sync-file-event`
  updates progress and errors only; it must not call `readFile`, `hashFile`, or refresh NoteCache.
- Watcher refreshes are debounced and serialized. Keep at most one active vault scan and one trailing
  scan, and route concurrent changes for an open note through NoteCache's per-path single-flight.
- `sync.db` is the only source for note sync metadata on the frontend. `Sync.getNoteMetadata`
  performs a local database read and must never fetch history or contact the server.
- Sync engine writes replace files atomically before updating `sync.db`. Watcher echoes whose hash
  already equals `sync_state.local_hash` must not enqueue uploads.
- Sync queue operations are deduplicated by operation type and path in memory and SQLite. Creation
  history lookups are low-priority, persisted, and never run during note opening.
- General Settings owns the visible Cortex account summary and opens the shared `AuthModal`.
  Identity is server-scoped and includes an optional display name stored in the OS keychain.
- Enabling sync requires a valid session for the configured server at both UI and store layers.
  Signing out stops and disables sync, while Self-host selection, URL, and environment settings stay
  available and unchanged.

### Sync Ignore Preferences
Vault-scoped sync ignore preferences live in `<vault>/.cortex/sync-preferences.json`.
`excludedPaths` handles explicit file/folder ignores and `ignoreImages` skips image file paths
globally. `@cortex/platform/sync-rules` is the single policy: the sync engine uses it for local
watcher events, remote events, initial sync, reconciliation, and queued operations, and `syncStore`
re-exports the same functions for UI state and menu affordances.

### File Watching
- The main-process watcher (`electron/services/watcher.ts`) is one native recursive `fs.watch` per
  vault (FSEvents on macOS, ReadDirectoryChangesW on Windows), never a per-file watcher. Events are
  coalesced per path for 100 ms and classified by `stat`; it emits `vault-file-changed` to the owner
  renderer and feeds local changes to the sync worker (`notifyLocalFileChange`). `vaultStore` turns
  a `created` event for an already known path (atomic save) into `modified`.
- `vaultStore` batches watcher events: only unknown created paths rescan, deletions update `files`
  in place, and `modified` events never touch `files`; search/tag indexes update incrementally
  through `@cortex/core` `startAppRuntime`
- Prevents editor from overwriting external changes
- `FileSystem.startWatching` supports multiple watcher IDs plus `includeHidden` and
  `followSymlinks` options; keep the main vault watcher hidden-path-safe, and use dedicated hidden
  watchers for community plugin/theme hot reload.
- `list_dir` follows symlink metadata, but the hot-reload watcher (`fs.watch`) does not follow
  symlinks: development builds must be copied into `<vault>/.cortex/plugins/<id>` or
  `<vault>/.cortex/themes/<id>`. Any file written inside `<id>/` (except `settings.json` and
  `data/**`) reloads plugins; any event under `.cortex/themes` reloads themes.

### Workspace Persistence
- Tracks open tabs, pane splits, and positions
- Saved to `vault/.cortex/workspace.json` with 500ms debounce by `@cortex/core` `startAppRuntime`
- Restored on vault open via `loadWorkspace()`; app shells must not subscribe React roots to vault
  files or lifecycle state just to drive these side effects

## TypeScript Configuration

- **tsconfig.json** (root): References all packages and apps
- **packages/*/tsconfig.json**: Each package has `composite: true` and `declaration: true`
- **Type checking**: `bun run typecheck` runs `tsc -b` (build mode) across all references

## Dependency Management

- **bun workspaces**: Local packages use `workspace:*` protocol
- **No dependency duplication**: Shared deps in root `package.json` when possible
- **Peer dependencies**: UI package declares `react >= 19` as peer

## When Implementing Features

1. **Design the types/interfaces first** — this drives the implementation
2. **Self-documenting code** — add comments only for non-obvious constraints
3. **Biome first** — run `bun run check:fix` before committing
4. **Stores for shared state** — don't prop-drill
5. **Platform abstraction** — never call IPC directly from UI
6. **CSS classes for styling** — primitives never use inline styles

## Phases (Implementation Progress)

- **Phase 1**: Monorepo + desktop shell (Electron) ✅
- **Phase 2**: Vault ops, FileSystem, Watcher, Dialog ✅
- **Phase 3**: Editor (CodeMirror 6), NoteCache ✅
- **Phase 4**: UI primitives, multi-tab/split-pane layout ✅
- **Phase 5**: Theme system integration ✅
- **Phase 6+**: Settings UI, advanced features (coming)
