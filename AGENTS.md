# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**Cortex** is a modular markdown platform with desktop app and developer tooling. The architecture is a monorepo using bun workspaces, with clear separation between:
- **apps/cli** — Official Cortex CLI (Go) for plugin/theme create, validate, and publish workflows
- **apps/desktop** — The Tauri application entry point
- **packages/** — Reusable modules (ui, core, platform, ipc, theme, editor, settings)

## Package responsibilities

```
cortex/
├── apps/
│   ├── desktop/                    # App Tauri (shell Rust + frontend React/Vite)
│   │   ├── src-tauri/              # Camada nativa Rust
│   │   │   ├── src/
│   │   │   │   ├── commands/       # Handlers IPC expostos ao frontend via tauri-specta
│   │   │   │   │   ├── vault.rs    # open_vault, close_vault, scan_vault, get_vault_metadata
│   │   │   │   │   ├── fs.rs       # read_file, write_file, delete_file, rename_file, hash_file
│   │   │   │   │   ├── watcher.rs  # start_watching, stop_watching (emite eventos Tauri)
│   │   │   │   │   ├── window.rs   # open_vault_in_new_window, get_window_label
│   │   │   │   │   ├── dialog.rs   # pick_folder, show_confirm_dialog
│   │   │   │   │   ├── shell.rs    # open_in_system_explorer, reveal_file
│   │   │   │   │   ├── registry.rs # update_vault_registry, read_vault_registry, remove_from_vault_registry
│   │   │   │   │   ├── auth.rs     # keychain read/write para tokens e device identity
│   │   │   │   │   └── menu.rs     # macOS native menubar: build_menu, refresh_menu_recents, File > Recents submenu
│   │   │   │   ├── sync/           # Engine de sync — roda em thread Rust separada
│   │   │   │   │   ├── engine.rs   # Loop principal: detecta mudanças, enfileira ops, executa
│   │   │   │   │   ├── uploader.rs # Upload de arquivos via HTTP POST com retry e backoff
│   │   │   │   │   ├── downloader.rs # Download e aplicação de versões remotas
│   │   │   │   │   ├── sse.rs      # Cliente SSE persistente: conecta, reconecta, emite eventos Tauri
│   │   │   │   │   ├── merge.rs    # Three-way merge via diff-match-patch (Markdown) e JSON merge
│   │   │   │   │   ├── conflict.rs # Detecção de conflito via hash triplo (local/remote/ancestor)
│   │   │   │   │   ├── db.rs       # Interface com sync.db (SQLite): leitura e escrita de sync_state
│   │   │   │   │   └── auth.rs     # Refresh de access token, fluxo de device token
│   │   │   │   ├── keychain/       # Abstração cross-platform para keychain do OS
│   │   │   │   │   └── mod.rs      # macOS Keychain, Windows Credential Manager, Linux libsecret
│   │   │   │   ├── protocol/       # Protocolo cortex:// para servir assets do vault ao webview
│   │   │   │   │   └── mod.rs
│   │   │   │   └── main.rs         # Entry point Tauri: registra comandos, plugins, setup inicial
│   │   │   └── Cargo.toml
│   │   └── src/                    # Entrada React — composição dos packages
│   │       ├── main.tsx            # initPlatform(tauriAdapter), monta React app
│   │       └── App.tsx             # Composição de layout, providers, workspace
│   └── mobile/                     # (futuro) React Native — consome packages/core e packages/platform
├── packages/
│   ├── core/                       # Lógica pura: vault, metadata, eventos, Note Cache, índice; usa a abstração de plataforma.
│   ├── commands/                   # Registry agnóstico de comandos, hotkeys associadas e nomes Vim
│   ├── editor/                     # Motor de edição: CodeMirror 6 + extensões Markdown + Live Preview
│   ├── ui/                         # Componentes React compartilhados, design system
│   ├── plugin-api/                 # Contratos públicos que plugins podem importar
│   ├── platform/                   # Abstração de plataforma: adapters para Tauri e RN, definição dos tipos principais do filesystem, dialogs e etc.
│   ├── settings/                   # Engine de configurações, cache em memória, persistência
│   ├── templates/                  # Linguagem segura e renderização de templates de notas
│   ├── search/                     # MiniSearch: indexação, serialização, queries
│   ├── theme/                      # Engine de temas e variáveis CSS para superfícies web
│   ├── theme-mobile/               # Extrator opt-in CSS→tokens para o futuro app React Native
│   ├── sync-client/                # Estado reativo do sync no frontend: status, conflitos, UI bridge
│   └── ipc/                        # Implementação Tauri do pacote platform, com wrappers IPC tipados
├── plugins/                        # Plugins core bundled
│   ├── file-explorer/
│   ├── quick-switcher/
│   └── ...
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

Run `bun run check` to lint, format, and organize imports all at once. Use `bun run check:fix` to auto-fix issues.

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
bun run check             # Lint + format + organize imports (all at once)
bun run check:fix         # Auto-fix all issues
bun run check:boundaries  # Validate workspace dependencies, layers, and cycles
bun run typecheck         # TypeScript compilation check across monorepo
bun run test:frontend     # Run all deterministic frontend suites
bun run test:rust         # Run the Rust workspace suite
bun run test              # Run frontend and Rust suites
bun run benchmark:editor  # Run editor performance benchmarks from tools/benchmarks
bun run benchmark:file-explorer # Run desktop file tree benchmarks from tools/benchmarks
bun run benchmark:large-vault # Run desktop large-vault diagnostic workbench
bun run tauri dev         # Start Tauri dev server (from apps/desktop/)
```

### Running the App
```bash
cd apps/desktop
bun run tauri dev         # Launch Tauri window with hot reload
bun run tauri build       # Build release binary
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
| **platform** | Abstract platform interface | FileSystem, Dialog, Vault, Storage interfaces + Tauri adapter |
| **ipc** | Typed IPC wrappers over Tauri | invoke() and event wrappers for commands |
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
- **src-tauri/** — Rust source (commands, Tauri config)

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
Rust commands are abstracted behind `@cortex/platform` interfaces. Desktop code never directly imports from IPC; it uses platform methods:

```typescript
// ✅ DO
const platform = getPlatform()
const files = await platform.vault.scanVault(path)

// ❌ DON'T
import { scanVault } from "@cortex/ipc"
const files = await scanVault(path)
```

The platform adapter (`packages/platform/src/adapters/tauri/`) bridges to actual IPC calls.

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
vault-level markers are stored through `@cortex/platform` storage paths, not Tauri-specific APIs.
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
  Plugins register or override callout types with `api.markdown.registerCalloutType(...)`; later
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
- Plugins extend every Markdown surface through `api.markdown.registerInline(...)` and
  `api.markdown.registerSemantic(...)`. Semantic output is limited to validated portable nodes;
  arbitrary DOM, HAST, CodeMirror widgets, event handlers, and inline styles are not public API.
- Semantic registrations compose by priority over portable text nodes. `registerInline(...)` is the
  regex convenience layer over the same portable-node transformation path.
- `api.markdown.registerProcessor(...)` is the advanced Unified escape hatch for explicitly selected
  `reading-view` and `export` surfaces. Processors declare one `remark` or `rehype` phase, run in
  priority order on cloned trees, and always run before HTML sanitization. Live Preview-specific
  behavior belongs in semantic registrations or `api.editor.registerExtension(...)`.
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
- Community plugin `styles.css` files require the `markdown:extensions` capability. The runtime
  parses and scopes them to `.markdown-surface`, installs them only while the plugin is enabled,
  and rejects global at-rules.
- Community theme manifests contain identity and light/dark stylesheet paths without API
  versioning. Desktop and Marketplace treat stylesheet contents as opaque browser CSS; they do not
  parse selectors, require tokens, or reject CSS based on future mobile compatibility.
- Theme installation validates paths and assets in staging and restores the previous theme if
  promotion or reload fails. These filesystem protections remain independent from CSS parsing.
- `@cortex/theme-mobile` is the only package allowed to parse theme CSS into portable tokens. It is
  opt-in for the future React Native app and must never be imported by `@cortex/theme`,
  Marketplace, or desktop code. Desktop never generates `.tokens.json`.
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

### Adding a New Rust Command
1. Create in `apps/desktop/src-tauri/src/commands/` (e.g., `mycommand.rs`)
2. Add to `commands` module in `main.rs`
3. Register with `#[tauri::command]`
4. Wrap in `@cortex/ipc` and expose via platform

### Debugging
- **DevTools**: Open with keyboard shortcuts in Tauri
- **Store inspection**: Zustand devtools shows in browser console
- **CSS issues**: Check computed styles for theme variables
- **Type errors**: Run `bun run typecheck` to catch TS issues across monorepo
- **Performance benchmarks**: Keep benchmark-only files outside production source trees under
  `tools/benchmarks/` or app-local benchmark folders such as `apps/desktop/benchmarks/`, and expose
  them through root `benchmark:*` scripts.

## Important Implementation Details

### macOS Native Sidebar
macOS window material is configured through `apps/desktop/src-tauri/tauri.macos.conf.json`.
Do not apply vibrancy manually in Rust for the main window; keep the native sidebar material in
Tauri window configuration so it stays platform-scoped and avoids duplicate `NSVisualEffectView`
layers. Traffic light placement is owned entirely by the macOS setup path: use a 40px titlebar,
14px left inset, 8px gaps, and center the native button size vertically. Do not duplicate this
geometry with `trafficLightPosition` in Tauri JSON. The React shell uses `app-shell`, `app-titlebar`, `app-content`,
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
Left-sidebar view navigation lives in `SidebarViewCarousel`: core views precede plugin views, the
active item reveals its label, and the fixed `All views` Command picker provides direct access.
Settings stays outside the carousel in the footer while the active view owns the flexible scroll
region. Do not add CSS backdrop blur over the native sidebar material.

### Native Desktop Shell
Keep `apps/desktop/src-tauri/tauri.conf.json` platform-neutral. macOS-only chrome belongs in
`tauri.macos.conf.json`; Windows-only chrome belongs in `tauri.windows.conf.json`. Window-level
materials should come from Tauri/window effects, not CSS blur layered over opaque web surfaces.
Settings opens through `getPlatform().window.openSettings(...)` as a dedicated Tauri webview
window when a vault is active; `SettingsModal` is only a fallback. Shared settings layout lives
in `SettingsContent`.

### Native Notifications
All app and plugin notifications must go through `getPlatform().notifications`, never DOM toasts
or browser notification APIs. Desktop delivery is implemented by `@cortex/ipc` through Tauri's
notification plugin; future mobile adapters should implement the same `Platform.notifications`
interface and no-op unsupported feature fields instead of throwing. Core app notifications bypass
plugin permission checks but still respect OS permission and platform support.

Plugins must declare `"notifications"` in `PluginManifest.capabilities` before calling
`api.notifications.send(...)` or `api.ui.showNotice(...)`. `@cortex/plugin-host-core` validates
unknown capabilities during discovery and enforces the notification capability at call time. Plugins
cannot request OS notification permission directly; permission prompts are owned by the host app.

### Workspace Marketplace
Marketplace is a first-class desktop workspace view, not a Settings section. Community plugin/theme
browse buttons, the sidebar Marketplace entry, and app commands should call the desktop-owned
`openMarketplaceView(tab)` helper so the existing Marketplace view tab is reused, activated, and
switched between plugins/themes without adding Marketplace routing to `useUIStore` or the settings
window URL. Settings browse actions must close Settings or ask the main window to open Marketplace
instead of opening a hidden workspace tab inside the Settings window.

Community plugins and themes are vault-scoped. The desktop app loads plugins from
`<vault>/.cortex/plugins` and themes from `<vault>/.cortex/themes`; the CLI should link development
plugins/themes into those vault directories with `--vault`, `CORTEX_VAULT`, or vault ancestor
detection. Marketplace release assets must include `manifest.json` plus the installable bundle/CSS
assets as individual GitHub Release assets, not only a ZIP archive.
Plugins that need temporary read-only Markdown notes, such as onboarding or plugin changelogs,
should call `api.workspace.openMarkdownTab(...)` with the `ui:views` capability. Desktop renders the
content as an ephemeral workspace tab and must not write it to the vault, `noteCache`, or
`.cortex/workspace.json`.

### Editor Setup
- `@cortex/editor` owns editable Markdown surfaces, CodeMirror runtime loading, extensions, and
  Live Preview projection.
- Production CodeMirror value imports stay behind the lazy loader in
  `packages/editor/src/runtime.ts`.
- Syntax highlighting colors resolve from CSS variables when the editor runtime mounts.

### Keyboard Shortcuts
- App command and hotkey wiring lives in `apps/desktop/src/hooks/useAppCommands.ts`
- Feature-local shortcuts remain in their owning component files
- Use native event handlers (`onKeyDown` checks `event.key`, `event.metaKey`)
- No library (too opinionated for this app)

### Sync Logging Architecture
Sync logs follow a **single-source-of-truth** model — Rust is the authority for engine events, the frontend only logs what it originates:

**Rust (engine.rs → `emit_log` → `sync-log` Tauri event)**:
- State transitions (connecting, live, offline, denied, etc.)
- Initial sync start/complete/fail
- DB errors, VEK errors, reconciliation errors
- File sync operation errors (from process_queue)
- Conflicts detected
- Vault access denied (403)

**Frontend (useSyncLogStore.getState().log() directly)**:
- Sync lifecycle start/stop decisions (useSyncLifecycle.ts)
- Vault access denied handling on JS side (auto-unlink)

**Never duplicate**: If an event originates in Rust, only Rust logs it. The frontend `onSyncLog` listener bridges Rust logs into `syncLogStore`. Frontend code must NOT add its own log call for the same event.

**Never log tokens or secrets**. Server URLs and vault IDs are safe for debugging self-hosted setups.

### Sync File Authority

- The native watcher is the frontend authority for content that changed on disk. `sync-file-event`
  updates progress and errors only; it must not call `readFile`, `hashFile`, or refresh NoteCache.
- Watcher refreshes are debounced and serialized. Keep at most one active vault scan and one trailing
  scan, and route concurrent changes for an open note through NoteCache's per-path single-flight.
- `sync.db` is the only source for note sync metadata on the frontend. `Sync.getNoteMetadata`
  performs a local database read and must never fetch history or contact the server.
- Rust sync writes replace files atomically before updating `sync.db`. Watcher echoes whose hash
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
globally. Rust `sync/ignore.rs` is the authority used by local watcher events, remote events,
initial sync, reconciliation, and queued operations. Frontend helpers in `syncStore` mirror this
policy only for UI state and menu affordances.

### File Watching
- Rust `notify` crate emits `vault-file-changed` events
- `vaultStore.refreshFiles()` polls vault on file changes
- Prevents editor from overwriting external changes
- `FileSystem.startWatching` supports multiple watcher IDs plus `includeHidden` and
  `followSymlinks` options; keep the main vault watcher hidden-path-safe, and use dedicated hidden
  watchers for community plugin/theme hot reload.
- `list_dir` follows symlink metadata so vault-scoped CLI links are discoverable as plugin/theme
  directories. CLI dev/link writes `.reload-<id>` marker files in the hidden plugin/theme directory
  to trigger immediate desktop rediscovery.

### Workspace Persistence
- Tracks open tabs, pane splits, and positions
- Saved to `vault/.cortex/workspace.json` with 500ms debounce
- Restored on vault open via `loadWorkspace()`

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

- **Phase 1**: Monorepo + Tauri shell ✅
- **Phase 2**: Vault ops, FileSystem, Watcher, Dialog ✅
- **Phase 3**: Editor (CodeMirror 6), NoteCache ✅
- **Phase 4**: UI primitives, multi-tab/split-pane layout ✅
- **Phase 5**: Theme system integration ✅
- **Phase 6+**: Settings UI, advanced features (coming)
