# AGENTS.md

Guidance for coding agents (and humans) working in this repository. This file is the single source
of truth: `CLAUDE.md` files only import it, and Codex, Cursor, Copilot, Gemini CLI, Zed, and
others read `AGENTS.md` directly. Each package or app may add its own `AGENTS.md` with local rules;
read the nearest one before editing files there.

## Project

Cortex is a local-first Markdown workspace: an Electron desktop app (the main target), an Expo
mobile app, a web app (site, docs, account, sync server), and reusable TypeScript packages. Notes
are plain Markdown files in a user-owned vault folder; app state lives in `<vault>/.cortex/`.

```
apps/desktop      Electron main process (electron/) + React 19/Vite renderer (src/)
apps/mobile       Expo React Native app (outside the default CI gate)
apps/web          TanStack Start site, docs, account pages, and sync server routes
packages/core     platform-neutral stores, NoteCache, vault index, indexing, runtimes, sync state
packages/platform platform interfaces + pure path/vault/sync rules shared by every adapter
packages/editor   CodeMirror 6 runtime, Live Preview, Reading View
packages/renderer sanitized Markdown → HTML pipeline (reading, export, callouts, math)
packages/ui       React primitives and design-system classes (desktop + web)
packages/commands command registry, hotkeys, Vim names
packages/properties  frontmatter, property schemas, databases query/view logic
packages/plugin-api  public `@cortex.md/api` contract for community plugins
packages/plugin-host-core  portable plugin host and contribution store
packages/marketplace  install/update/uninstall, staging, extension sync
packages/sync-engine  sync worker (desktop utilityProcess, mobile JS thread)
packages/sync-api     fetch-only server client shared by desktop main, mobile, web
packages/…        search, settings, theme, tasks, comments, collab, import-export
plugins/          bundled plugins (`definePlugin` modules), listed once in plugins/index.ts
tools/benchmarks  micro benchmarks and real-app performance budgets
docs/             contributor and community (plugin/theme author) docs
```

## Commands

```bash
bun install
bun run dev:desktop        # Electron + Vite with hot reload
bun run check              # Biome lint/format/imports (desktop scope); check:fix to apply
bun run typecheck          # TypeScript for desktop, its packages, plugins, benchmarks
bun run check:boundaries   # workspace dependency layers and cycles
bun run test               # all desktop-scoped Vitest projects
bun run doctor             # React Doctor on changed desktop files
bun run build              # production desktop bundles (apps/desktop/out)
bun run perf               # real-app budgets (needs bun run build)
bun run check:mobile | test:mobile | doctor:mobile   # mobile gate
bun run check:web | test:web                         # web gate
```

Before handing off a change, run the gate for the area you touched (desktop: `check`,
`typecheck`, `check:boundaries`, `test`; plus `doctor` for React changes). CI (`.github/workflows`)
runs the desktop gate on pull requests; mobile and web run only when their paths change.

## Golden Rules

- **Boundaries.** Respect package ownership and the layers enforced by `check:boundaries`. Shared
  logic goes in packages, not apps. Packages are consumed as source (`workspace:*`).
- **UI.** Use `@cortex/ui` primitives instead of raw HTML controls or new local components.
  Primary actions use the default `Button`; neutral actions pick `secondary`, `outline`, or
  `ghost`. Neutral hover/selected states use `fill-quiet*` / `fill-selected` tokens. Primitives
  never use inline styles or business logic.
- **Platform.** UI and stores reach the OS only through `getPlatform()` from `@cortex/platform`;
  never call IPC, `window.cortex`, Node, or Expo APIs from shared code.
- **Commands.** Every app and plugin action is a `CommandEntry` in `@cortex/commands`; the palette,
  hotkeys, native menus, context menus, slash menu, toolbar, and Vim execute the same ids. Never
  keep a separate command list for one surface.
- **Editor.** CodeMirror value imports stay behind the lazy runtime loader in `@cortex/editor`.
  Frontmatter never enters CodeMirror; `@cortex/properties` owns structured metadata.
- **Notes.** UI reads and writes notes only through `noteCache` (`@cortex/core`); out-of-editor
  edits use `mutateNote`. Renames and moves go through `vaultStore`.
- **Notifications** go through `getPlatform().notifications`, never DOM toasts or browser APIs.
  Plugins must declare the `notifications` permission.
- **Secrets.** Tokens, keys, and the vault encryption key stay in the desktop main process or the
  OS keychain. Never log tokens or secrets.

## Code Style

- Biome owns formatting: tabs, 100-column lines, double quotes, no semicolons, organized imports.
- Self-documenting names (`openVault`, `activeFilePath`); add comments only for non-obvious
  constraints. Define types and interfaces before implementation.
- Background failures update a store error or emit a structured log; no empty `catch` blocks.
- Run independent awaits with `Promise.all`; bound vault-wide work with worker pools.

## React

- Hoist static arrays, objects, and pure helpers out of components. Select narrow store slices.
- Initialize state synchronously with lazy `useState`; use `useSyncExternalStore` for external
  state; drive measurement-only styling through CSS variables instead of renders.
- Subscriptions that need the latest callback use `useEffectEvent` instead of re-subscribing.
- Render UI through named components, never `renderX()` helpers in JSX.
- Commit-on-blur fields use an uncontrolled input with `defaultValue` and a `key`; do not mirror
  props into state with effects.
- Rarely used surfaces are lazy and mount on first open; drags update the DOM and commit once.

## Vault Layout (`<vault>/.cortex/`)

| Path | Purpose | Synced |
| --- | --- | --- |
| `vault.json` | vault id, name, creation time (identity; never regenerate an existing id) | no |
| `local.json` | device-local state (tag colors, search history, enabled plugins, UI state) | no |
| `sync.json` | sync config (`config`) and preferences (`preferences`) | no |
| `app.json`, `hotkeys.json`, `workspace.json`, `bookmarks.json` | settings, overrides, layout, bookmarks | opt-in per toggle |
| `plugins.sync.json`, `themes.sync.json` | extension manifests | opt-in per toggle |
| `schema/properties.json`, `inbox.md`, `comments/` | property schema, task inbox, comment sidecars | always |
| `history/`, `plugins/`, `themes/`, `templates/`, `sync.db` | local history, extensions, templates, sync DB | no |
| `cache/` | rebuildable caches (search index, notes index, database rows) | never |

Paths come from `VAULT_FILES` (`@cortex/platform/utils`); sync policy from
`@cortex/platform/sync-rules`, shared by the sync engine and the UI. There is no legacy layout
support; state files are written through the platform state-file engine (atomic, serialized).

## Sync Invariants

- The native watcher is the authority for disk changes; sync file events are state-only and never
  read, hash, or refresh notes. `sync.db` is the only source of note sync metadata.
- The sync engine writes files atomically before updating `sync.db`; watcher echoes whose hash
  matches the stored hash never enqueue uploads.
- The engine logs what it originates; the frontend logs only its own lifecycle decisions.
- Entitlement checks happen only at workflow boundaries, never in watcher, queue, or save paths.
  Self-hosted sync never requires a Cortex Cloud plan.

## Plugins and Themes

- Plugins export `definePlugin({ manifest, settings, contributes, activate, load })` from
  `@cortex.md/api`. Hosts register contributions without running plugin code and activate lazily.
  Core views and settings use the same contribution store with owner `"core"`.
- Community plugins run in the editor realm without isolation (Obsidian model); safety is opt-in
  (`plugins.allowCommunity`, off by default), declared permissions, review, and scanning.
- Plugins and themes are vault-scoped (`.cortex/plugins`, `.cortex/themes`). Theme CSS is opaque
  browser CSS; only manifests are parsed.
- The CLI (cortex-md/cli) and registry (cortex-md/registry) mirror the plugin permission list,
  community loader, and theme manifest schema; change them together.

## Performance

- Measure before and after any performance change: `bun run build`, then `bun run perf`
  (`-- --scale roadmap` for 50k notes) and the relevant `bun run bench*`. Keep only changes with a
  measured gain. Never edit sources while a build is running.
- Benchmark and profiling code lives only in `tools/benchmarks/`.

## Tests and Docs

- Write tests for critical logic only: sync, data integrity, indexing, migrations, plugin loading,
  and security rules. Do not add per-component or snapshot tests to reach coverage.
- When you change a rule that an `AGENTS.md` states, update that file in the same change. Keep these
  files durable: rules and invariants, not change logs, measurements, or file inventories.
- Public user and plugin/theme author docs live only in the web docs
  (`apps/web/src/content/docs/`); contributor docs in `docs/development/`.
- Contribution workflow, PR checklist, and commit conventions: `CONTRIBUTING.md`.
