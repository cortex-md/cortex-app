# Architecture

Cortex is a Bun + TypeScript monorepo. Apps compose shared packages; packages hold the logic so the
desktop app, the mobile app, and developer tooling share the same contracts.

## Runtimes

The desktop app (`apps/desktop`) is Electron with four parts:

| Part | Where | Owns |
| --- | --- | --- |
| Main process | `apps/desktop/electron` | Native OS work: filesystem, watcher, keychain, menus, windows, updates, IPC |
| Preload | `apps/desktop/electron/preload.ts` | `window.cortex.invoke(domain, method, args)` bridge only |
| Renderer | `apps/desktop/src` | React shell, features, stores, editor, plugin host |
| Sync worker | `utilityProcess` running `@cortex/sync-engine` | `sync.db`, upload and download planning, merges |

The search index runs in a Web Worker inside the renderer
(`apps/desktop/src/features/search/searchWorkerBackend.ts`). The mobile app (`apps/mobile`, Expo)
reuses the same packages, with a WebView for the editor and plugins. The website (`apps/web`,
TanStack Start) publishes the user and plugin docs from `apps/web/src/content/docs`.

## Packages

| Package | Role |
| --- | --- |
| `@cortex/platform` | Cross-platform contracts (filesystem, vault, dialogs, windows, storage), path utilities, `.cortex` file names, sync rules, the state file engine |
| `@cortex/core` | App logic and stores: vault and `VaultIndex`, NoteCache, workspace, note metadata index, sync state, runtimes |
| `@cortex/editor` | CodeMirror runtime, Live Preview, Reading View, editor commands (lazy loaded) |
| `@cortex/renderer` | Sanitized Markdown to HTML pipeline and callout registry |
| `@cortex/properties` | Frontmatter properties, schema, database config, the shared inline tag rule |
| `@cortex/search` | MiniSearch index, search store, worker-friendly backend |
| `@cortex/commands` | Command registry, hotkeys, recent commands |
| `@cortex/settings` | Settings schema, defaults, persistence |
| `@cortex/theme` | Paper and Ink tokens, CSS variable generator, community theme manifests |
| `@cortex/ui` | Shared React primitives |
| `@cortex/plugin-host-core` | Portable plugin host, contribution store, community plugin loader |
| `@cortex.md/api` | Public plugin API published to npm |
| `@cortex/marketplace` | Install, update, rollback, and extension sync |
| `@cortex/sync-engine`, `@cortex/sync-api` | Sync engine and the server API client |
| `@cortex/collab`, `@cortex/comments`, `@cortex/tasks`, `@cortex/import-export` | Collaboration, comment threads, tasks, importers |

Allowed dependencies between packages are declared in `scripts/check-workspace-boundaries.ts` and
checked by `bun run check:boundaries`. `@cortex/platform`, `@cortex/properties`, `@cortex/theme`,
`@cortex/ui`, and `@cortex.md/api` sit at the bottom and depend on no other workspace package.
Plugin bundles may import only `@cortex.md/api`.

## Package Ownership

- `apps/desktop` owns Electron desktop composition, desktop feature UI, shell layout, settings windows,
  and native app integration.
- `@cortex/core` owns pure app logic, stores, NoteCache, vault state, sync state, onboarding logic,
  and shared domain behavior.
- `@cortex/platform` defines cross-platform contracts for filesystem, dialogs, windows, storage,
  notifications, and app services.
- `@cortex/editor` owns CodeMirror setup, Markdown editing, Live Preview, keymaps, and editor
  runtime loading.
- `@cortex/renderer` owns sanitized rendered Markdown semantics.
- `@cortex/ui` owns shared React primitives only.
- `@cortex.md/api` is the public plugin API. Keep it free of React, DOM, Electron, CodeMirror, and
  internal implementation packages.

## Platform Boundaries

React desktop code should not call Electron APIs directly. Use the platform abstraction:

```ts
import { getPlatform } from "@cortex/platform"

const platform = getPlatform()
const files = await platform.vault.scanVault(vaultPath)
```

If a feature needs new native behavior:

1. Add or extend the `@cortex/platform` contract.
2. Implement it in the main-process service object typed by `MainApi` (`apps/desktop/electron/services`).
3. Override it in `apps/desktop/src/platform/electron-platform.ts` only when it needs callbacks or local logic.
4. Call the platform method from desktop or core code.

## React And UI

- Prefer `@cortex/ui` primitives over raw HTML when a primitive exists.
- Keep feature-specific React state close to the desktop feature that owns it.
- Hoist static arrays, options, and pure helpers out of components when they do not need render-local
  data.
- Use `Promise.all` for independent async work.
- Avoid mirroring props into local state for commit-on-blur inputs. Prefer uncontrolled inputs with
  `defaultValue`, a stable `key`, and an `onBlur` commit.
- Use React Doctor for React-facing desktop changes.

## Files, Notes, And Vaults

- Shared stores should work with logical vault paths that use `/` separators.
- UI may show `displayPath` when a platform adapter provides a native presentation path.
- Creating files and folders should treat a successful filesystem write as creation success.
  Hashing, metadata refresh, cache priming, indexing, and UI refresh are post-create work.
- Note title renames should go through `vaultStore.renameFile` so tabs, bookmarks, NoteCache, and
  filesystem state move together.

## Editor And Markdown

- Frontmatter must not enter CodeMirror documents, cursor positions, selections, or coordinate
  models.
- Shared rendered Markdown semantics belong in `@cortex/renderer`.
- Editable Markdown behavior belongs in `@cortex/editor`.
- Desktop CSS owns Reading View, Side-by-Side, and app shell layout. Live Preview projection styles
  belong with the editor package.

## Main Process

- Keep main-process code limited to native OS work: filesystem, file watching, keychain, protocol
  handling, menus, windows, updates, and the sync worker bridge.
- Validate renderer input at the boundary (`assertAllowedPath`, restricted keychain keys).
- Keep fatal errors scoped. For vault scans, inaccessible roots are fatal; unreadable children should
  be skipped when possible so one locked file does not make the vault appear empty.

## Tests And Documentation

- Keep the test suite lean: test critical behavior and regressions, not every code path.
- Update docs when setup, commands, public APIs, package ownership, or contribution workflow changes.
- Avoid unrelated refactors in bug-fix pull requests.
