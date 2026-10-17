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
    updates/           self-hosted updater: signed manifest, verified download, platform installers
    shutdownHooks.ts   before-install hooks (flush, then teardown) run before the app quits to update
  src/                 React renderer and desktop feature composition
  src/bootstrap/       Desktop host: commands, core contributions, plugin host
  src/features/        Desktop-owned features such as files, tabs, settings, sync, vault UI
  src/styles/          Desktop CSS (layout, sidebar, command surfaces, macOS overrides)
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

## Workers

- **Search:** MiniSearch runs in a Web Worker inside the renderer
  (`src/features/search/searchWorkerBackend.ts`). It also builds the Quick Finder's text snippets.
- **Sync:** see below.

Benchmarks and the `bun run perf` harness live in `tools/benchmarks` (see
[Performance](performance.md)).

## Sync

`@cortex/sync-engine` runs in a `utilityProcess` (`out/main/sync-worker.js`). The main process owns
tokens and vault keys and answers the worker's on-demand requests; the worker owns `sync.db`. The
pure server API client (`@cortex/sync-engine/api`) has no Node imports so mobile and web can reuse it.

## Updates

Cortex updates itself without Apple or Windows code-signing certificates, the way Tauri does: each
release publishes a `latest.json` manifest signed with Ed25519, and every package is checked
against the SHA-256 inside that signed manifest. The same flow runs on every platform.

- `services/appUpdates.ts` is the IPC facade. With `updates.autoCheck` on it loads
  `updates/updater.ts` with `import()` once the first window is visible and the renderer sent its
  preferences; the first check runs 10 s later, then one timer fires 6 h after the last check
  (re-armed on system resume). With it off the updater never loads unless the user acts. The renderer only calls `configure`, `checkForUpdate`,
  `downloadUpdate`, `installNow`, and `setInstallOnQuit`, and listens to `app-update-status`.
- States: `idle → checking → available → downloading → verifying → ready → installing`, plus
  `up-to-date`, `error` (with an `AppUpdateErrorCode`), and `unsupported` (development builds).
- `updates/source.ts` fetches `latest.json` and `latest.json.sig` (stable:
  `releases/latest/download`, beta: the newest release with a manifest from the releases API) and
  verifies the signature with `updates/publicKey.ts` **before** parsing. `updates/manifest.ts`
  accepts only HTTPS URLs under `github.com/cortex-md/cortex-app/releases/download/`; redirects
  may land only on GitHub download hosts. Versions not newer than the running one are ignored.
- `updates/download.ts` streams to `<file>.part`, hashes while writing, resumes with `Range`, and
  renames to the final name only when size and hash match. Automatic downloads wait for AC power on
  laptops (`powerMonitor`); manual ones start right away. After a package is prepared,
  `prepared.json` records its hash so later launches reuse it without re-reading the file; the
  macOS zip is deleted once extracted.
- `updates/staging.ts` owns every path the updater writes: `userData/updates/<version>/`, AppImage
  downloads next to `$APPIMAGE` (`.<name>.<version>.update[.part]`), the macOS backup bundle
  (`.Cortex.app.backup`), and caches the old electron-updater/Squirrel.Mac left in the OS cache
  folder. `cleanStaging` keeps only the pending version and runs on start (also with automatic
  checks off) and after each check, so superseded, installed, or abandoned downloads never stay.
- Installers (`updates/installers/`, one `UpdateInstaller` per kind, picked by
  `updates/installType.ts`):
  - macOS (`zip`): extracts with `ditto`, checks `CFBundleIdentifier` and
    `CFBundleShortVersionString`, then a detached shell script waits for the app to exit, swaps the
    bundle through a sibling backup, clears quarantine, restores the backup on any failure, and
    relaunches with `open`. The app must run from `/Applications` (the app offers to move itself)
    and the folder must be writable; otherwise the update is revealed in Finder for a manual drag.
  - Windows (`nsis`, per-user): runs the installer with `--updated /S --force-run`, detached, and
    quits. Per-machine installs (Program Files) run the installer interactively, which asks for
    administrator rights.
  - Linux AppImage: downloads next to `$APPIMAGE`, `chmod 755`, atomic `rename` over the running
    file, relaunches after this process exits. deb, rpm, snap, flatpak, and tarballs only show the
    new version with a link to the release page.
- Before quitting to install, `flush` hooks ask every vault window to save notes and state files
  (`flushPendingWrites`) and flush reminder writes; a failure cancels the install. After the
  installer is handed off, `teardown` hooks stop the file watchers and ask the sync worker to drain
  and close `sync.db` (WAL checkpoint) before it is killed. "Install when Cortex quits" (the
  default) runs the same path from `before-quit`.

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
