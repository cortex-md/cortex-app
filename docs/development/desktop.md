# Desktop Development

The desktop app lives in `apps/desktop`. It is an Electron app: a TypeScript main process, a
sandboxed preload, a React/Vite renderer, and a `utilityProcess` that runs the sync engine.

## Run The App

From the repository root:

```bash
bun install
bun run dev:desktop      # electron-vite dev server + Electron
bun run build            # production bundles in apps/desktop/out
bun run dist:desktop     # build + electron-builder packages in apps/desktop/release
```

## Desktop Structure

```text
apps/desktop/
  electron/
    main.ts            Single instance, deep links, window lifecycle
    preload.ts         contextBridge: window.cortex.invoke(domain, method, args) / on(event)
    security.ts        Path allowlist, trusted IPC sender, external URL protocols
    contract.ts        MainApi/MainEvents: typed IPC contract shared by main, preload, renderer
    ipc/register.ts    The MainApi object: one entry per platform domain
    services/          fs, vault, registry, watcher, keychain (safeStorage), dialogs, updates, sync bridge
  src/                 React renderer and desktop feature composition
  src/bootstrap/       Desktop host: commands, core contributions, plugin host
  src/features/        Desktop-owned features such as files, tabs, settings, sync, vault UI
  benchmarks/          App-local diagnostic workbenches
```

## Native Commands And IPC

`@cortex/platform` is the single source of truth for native contracts. `electron/contract.ts`
derives `MainApi` (request/response methods per domain) and `MainEvents` (main → renderer events)
from those types. The main process registers one object typed as `MainApi`, so a missing or
mistyped handler is a compile error. The renderer reaches it through a typed proxy (`main.fs.readFile`).

To add native behavior:

1. Add the method to the `@cortex/platform` interface.
2. Implement it in the matching `apps/desktop/electron/services/*Api` object (`satisfies MainApi[...]`).
3. If it needs a callback or local logic, override it in `src/platform/electron-platform.ts`.

React and core code call `getPlatform()` and never import Electron or the desktop platform adapter directly.

Every filesystem path from the renderer is checked against an allowlist (registered vaults, paths the
user picked in a dialog, `userData`, temp). Keychain keys reachable from the renderer are limited to
`server_url` and `sync-env-secret:*`; tokens and vault keys stay in the main process.

## Sync

`@cortex/sync-engine` runs in a `utilityProcess` (`out/main/sync-worker.js`). The main process owns
tokens and vault keys and answers the worker's on-demand requests; the worker owns `sync.db`. The
pure server API client (`@cortex/sync-engine/api`) has no Node imports so mobile and web can reuse it.

## Desktop UI

- Use primitives from `@cortex/ui` when a shared primitive exists.
- Keep business logic in packages (`@cortex/core` and friends) so mobile can reuse it; keep desktop
  UI state in `apps/desktop/src/features`.
- Preserve native shell behavior across macOS, Windows, and Linux. Drag regions use
  `-webkit-app-region` in CSS.
- Test shell and layout changes with collapsed and expanded sidebar states.

## Desktop Validation

```bash
bun run check
bun run typecheck          # includes apps/desktop/tsconfig.electron.json and sync-engine
bun run check:boundaries
bun run test
bun run doctor             # React-facing changes
```
