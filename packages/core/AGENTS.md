# AGENTS.md — @cortex/core

This file provides guidance to Codex when working with state management in the Cortex core package.

## Purpose

`@cortex/core` exports:
- **Zustand stores** — React hooks for global state (vaultStore, editorStore, workspaceStore, uiStore)
- **NoteCache** — In-memory file cache with auto-save and snapshots
- **Database store** — Zustand bridge over the portable `@cortex/databases` engine
- Supporting utilities and types

All stores follow consistent patterns using **Zustand + Immer** for immutable-style updates.

## Store Pattern

Every store uses this structure:

```typescript
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

export interface MyState {
  // State properties
  count: number
  items: string[]

  // Action methods
  increment: () => void
  addItem: (item: string) => void
  asyncAction: () => Promise<void>
}

export const useMyStore = create<MyState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      count: 0,
      items: [],

      // Synchronous actions
      increment: () =>
        set((state) => {
          state.count++
        }),

      addItem: (item) =>
        set((state) => {
          state.items.push(item)
        }),

      // Async actions can use get()
      asyncAction: async () => {
        const current = get().count
        // ... do something
        set((state) => {
          state.count = current + 1
        })
      },
    })),
    { name: "myStore" }, // DevTools name
  ),
)
```

## Key Patterns

### 1. Types First
Define the state interface before implementation:

```typescript
export interface MyState {
  // Data
  value: string | null
  loading: boolean
  error: string | null

  // Actions
  fetchValue: (id: string) => Promise<void>
  clear: () => void
}
```

This makes the store's public API crystal clear.

### 2. Immer Mutations Look Like Mutations
With Immer, you write code that *looks* like mutations, but creates immutable updates:

```typescript
// ✅ Looks like mutation, but immutable under the hood
set((state) => {
  state.count++
  state.items.push(newItem)
  state.nested.value = newValue
})

// ❌ Don't manually spread — Immer does that
set((state) => ({
  ...state,
  count: state.count + 1,
}))
```

### 3. Async Actions Use get()
For async operations, access current state via `get()`:

```typescript
openVault: async (path: string) => {
  const platform = getPlatform()
  set({ loading: true, error: null })
  try {
    const metadata = await platform.vault.openVault(path)
    const files = await platform.vault.scanVault(path)
    const stopWatcher = await platform.fs.startWatching(path, () => {
      get().refreshFiles() // Call another action via get()
    })
    set((state) => {
      state.vault = metadata
      state.files = files
      state.loading = false
      state.stopWatcher = stopWatcher
    })
  } catch (e) {
    set((state) => {
      state.loading = false
      state.error = String(e)
    })
  }
}
```

### 4. Use in Components
Components call stores as hooks:

```typescript
export default function App() {
  // Destructure what you need
  const { count, increment, asyncAction } = useMyStore()

  const handleClick = async () => {
    await asyncAction()
  }

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+1</button>
      <button onClick={handleClick}>Async</button>
    </div>
  )
}
```

Zustand automatically re-renders only components that use changed state (shallow comparison).

### 5. Early Returns
Don't set state if operation is not needed:

```typescript
refreshFiles: async () => {
  const { vault } = get()
  if (!vault) return  // Early return if no vault
  try {
    const files = await getPlatform().vault.scanVault(vault.path)
    set((state) => {
      state.files = files
    })
  } catch (error) {
    console.error("[Vault refresh failed]", { vaultPath: vault.path, error })
    set({ error: String(error) })
  }
}
```

Background failures must update an existing store error field or emit a structured log. Do not add
empty `catch` blocks.

Remove dormant stores instead of keeping unexported Zustand state. A store belongs in `@cortex/core`
only when it is exported, wired into an active feature, or covered by an intentional test roadmap.
When stores need another store's current vault path or auth refresh side effect, use the internal
runtime bridge for that concern instead of adding reciprocal store imports.

### 6. Reactive Tag Index

`tagsStore.fileTags` is the reactive source of file-to-tag associations. Components should select
`fileTags[filePath]` and `tagColors` directly instead of subscribing to getter functions or creating
their own caches.
Use `tagsStore.setTagsForFile(filePath, tags)` for complete YAML `tags` replacements so NoteCache,
frontmatter, and the local tag index update together. Inline body tags remain indexed by
`extractAllTags`, but property-style tag editing should only mutate the YAML `tags` array.

Vault-wide indexes may read independent note files concurrently, but store mutations must happen
after collection so Zustand state, NoteCache entries, and derived maps are updated in one coherent
step. Keep per-file NoteCache external-change handling serialized by path because content, hash, and
dirty-state checks are ordered.
Note-opening surfaces that need hash, metadata, or cache identity should use `noteCache.readEntry`.
Keep `noteCache.read` as a content-only compatibility wrapper.
Keep vault-wide tag indexing bounded; do not issue one `readFile` per Markdown file at the same
time on large vaults.
Implement bounded concurrency with `Promise.all` worker pools that do not await inside loops; keep
the per-file work independent and merge results afterward.
Prefer `buildIndexFromFiles(vaultPath, files)` when the caller already has the scanned vault tree.
It reuses the persisted `.cortex/tags-index.json` fingerprints and avoids reopening unchanged notes.
Do not replace it with a path-only rebuild from desktop indexing flows.
NoteCache external-change loads should continue until the latest observed hash has been processed,
but still process one hash at a time per path.
Independent platform reads inside one step, such as reading file contents and hashing the same file,
may run through `Promise.all` when neither result affects whether the other call should happen.
For remote sync/member mutations, run independent entitlement and auth-refresh checks together, then
perform the mutation only after both have completed.

### 7. Database Store

`useDatabaseStore` owns application state for database catalogs, local indexes, and row mutations,
while `@cortex/databases` owns the framework-free catalog/index/query primitives. Database catalog
definitions are syncable in `.cortex/schema/databases.json`; `.cortex/database-index.json` is a
rebuildable local cache and must stay out of sync.

Rows are Markdown notes and cell values are frontmatter values. Mutating a database cell must go
through `@cortex/properties` helpers so schema semantics, YAML projection, and NoteCache stay aligned.
Title and path changes remain vault/editor responsibilities and should flow through the existing
vault rename/open-tab paths.
Linking or unlinking notes from databases must mutate the reserved `cortex-databases` membership
property through the properties runtime and then update the database index incrementally. Creating a
database page should use `vaultStore.createFile`, apply membership/default property values, and leave
the catalog in `@cortex/databases` as the source of view definitions.

### Workspace Tab Restore

Workspace restore must keep inactive file tabs suspended and call `noteCache.openTab` only for the
active file tab in each pane. This keeps large restored workspaces from loading every hidden note
into memory at startup. Opening or activating a suspended file tab should remain the point where its
NoteCache entry is created.
File tabs may represent non-Markdown files. Non-Markdown tabs, including PDFs, must not call
`NoteCache`, must not become editor active-file state, and should persist view state through the
workspace tab state instead.

### Note Sync Attribution

Use `loadNoteSyncAttribution` to combine local `sync.db` note metadata with the remote vault member
snapshot. Attribution represents the latest completed sync version only; local file modification
times and unsynced edits must not replace it. `membersStore.ensureMembers` deduplicates member loads
by server and vault so note surfaces and properties reuse one identity snapshot.

`syncStore.noteMetadataRevisions` is keyed by vault-relative file path. Increment only after
successful `synced` or `merged` file events so visible note surfaces can refresh their local metadata
without scanning or contacting the server.

### Note Path Presentation

Use `getNotePathPresentation(filePath, vaultPath)` for note titles and breadcrumbs. It returns the
vault-relative segments, omits the vault itself, and removes the Markdown extension from the note.
Use `getNoteTitleError(title)` to validate editable note titles before appending `.md`.
Creating a note or folder succeeds when the platform filesystem write/create call succeeds. Hashing,
metadata reads, cache priming, file refreshes, and indexing are post-create work; retry transient
metadata/hash reads briefly and log remaining failures instead of reporting that the file was not
created after it already exists on disk.

### Workspace Tabs

`workspaceStore.openTab(path)` creates a tab only when the file is not already open; otherwise it
activates the existing tab. Use `reuseActive: true` only for navigation surfaces that should replace
the current unpinned file tab, such as single-clicking a file in the sidebar. Explicit new-tab
gestures should call the default `openTab(path)` unless they intentionally need duplicate tabs.
Use `openViewTab(..., { ephemeral: true })` for temporary app-owned surfaces such as update
changelogs. Ephemeral tabs behave like normal tabs during the session, but `persistWorkspace` must
filter them and their `viewState` out so temporary content is never written into a vault workspace
snapshot.
Plugins must use `api.workspace.openMarkdownTab(...)` for temporary Markdown notes; do not expose
`workspaceStore` or raw ephemeral `openViewTab` access to plugin code.

### Platform Test Mocks

Store tests that mock `getPlatform().app` should include the complete app contract used by shared
callers: `getCurrentAppVersion`, `openExternalUrl`, and `resolveFileAssetUrl`.

### Vault File Moves

Use `vaultStore.moveFile(oldPath, targetParentPath)` for sidebar and app-initiated moves. It keeps
folder moves prefix-aware across NoteCache, open tabs, bookmarks, and property UI state, and it must
fail on destination collisions instead of auto-renaming or overwriting.

### Bookmarks

Bookmarks are vault-scoped note favorites stored in `.cortex/bookmarks.json` as versioned
`BookmarkEntry` objects with vault-relative Markdown paths. Keep `bookmarkedPaths` in sync with the
ordered list for O(1) lookup, normalize absolute desktop paths before persistence, and update
bookmarks through `vaultStore` rename/move/delete flows so favorites do not become stale.
Bookmark order is the persisted insertion order; do not add UI or plugin API reorder behavior unless
the product explicitly reintroduces manual ordering.

### Vault Onboarding

New-vault onboarding content and marker logic lives in `packages/core/src/onboarding`. The visible
welcome note is a normal Markdown file in the vault root, while app and vault markers are stored via
`getPlatform().storage` so desktop and future mobile adapters share the same behavior. Desktop may
choose when to present or open the pending note, but it should not duplicate note content or marker
rules.

## Existing Stores

### vaultStore
Manages the current vault (folder), its file tree, and the vault registry (recent vaults):

```typescript
export interface VaultState {
  vault: VaultMetadata | null        // Current vault metadata
  files: FileEntry[]                 // Files in vault
  recentVaults: VaultRegistryEntry[] // Recent vaults from registry
  loading: boolean
  error: string | null
  stopWatcher: (() => void) | null   // Function to stop file watcher
  pendingOnboardingNotePath: string | null

  openVault: (path: string, options?: OpenVaultOptions) => Promise<void>
  loadVaultSnapshot: (path: string) => Promise<void> // Load metadata/files/settings without a watcher
  closeVault: () => Promise<void>
  refreshFiles: () => Promise<void>
  loadRecentVaults: () => Promise<void>  // Also refreshes macOS menu recents
  clearPendingOnboardingNotePath: () => void
  removeRecentVault: (uuid: string) => Promise<void>
  createFile: (parentPath: string, name: string) => Promise<string>
  createFolder: (parentPath: string, name: string) => Promise<string>
  deleteFile: (filePath: string) => Promise<void>
  renameFile: (oldPath: string, newName: string) => Promise<string>
  duplicateFile: (filePath: string) => Promise<string>
  openDailyNote: () => Promise<string | null>
}
```

**Usage**: `const { vault, files, recentVaults, openVault, closeVault } = useVaultStore()`

`renameFile` is the authority for file and note-title renames. It validates portable filenames,
flushes the old NoteCache path before the filesystem operation, migrates cache timers and snapshots,
updates every matching workspace tab, rewrites matching bookmarks, and refreshes the vault tree.
Callers must not repeat those updates after invoking it.

When stores create note files by writing directly through the platform, they must seed the written
content into `noteCache` through the shared clean-note creation helper before the note is opened.
That helper uses `FileSystem.writeFileSnapshot(...)` when the adapter provides it, then falls back to
`writeFile` plus post-write hash/metadata retry and fallback cache priming. Stores must not report a
creation failure after the file already exists on disk. When stores delete files or folders, they
must forget the deleted NoteCache path and folder descendants so new notes cannot inherit stale
frontmatter or properties from a previous file at the same path. Freshly-created local notes should
mark their NoteCache entry as locally created so desktop properties do not apply stale remote
metadata for a reused path before sync publishes new metadata.

### editorStore
Tracks the currently active file and editor state:

```typescript
export interface EditorState {
  activeFilePath: string | null
  mode: EditorMode  // "source" | "live-preview" | "reading"
  cursor: CursorPosition | null

  setActiveFile: (filePath: string | null) => void
  updateCursor: (cursor: CursorPosition) => void
  setMode: (mode: EditorMode) => void
  flushActive: () => Promise<void>  // Flush current file to disk
}
```

**Usage**: `const { activeFilePath, mode, setMode } = useEditorStore()`

### workspaceStore
Manages the vault-scoped layout (split panes, tabs, their positions, and persisted sidebar layout):

```typescript
export interface WorkspaceState {
  splitTree: SplitTree                    // Recursive layout tree
  panes: Record<string, Pane>            // All panes by ID
  activePaneId: string                   // Currently focused pane
  // ... + many layout actions

  openTab: (filePath: string, opts?: OpenTabOptions) => void
  openViewTab: (viewId: string, title: string, opts?: OpenTabOptions) => void
  updateViewTabState: (tabId: string, paneId: string, viewState: ViewTabState) => void
  moveTabToNewSplit: (tabId: string, fromPaneId: string, targetPaneId: string, direction: SplitDirection, position: "before" | "after") => void
  loadWorkspace: (vaultPath: string) => Promise<void>
  persistWorkspace: (vaultPath: string) => void
}
```

**Usage**: Complex layout operations. See `apps/desktop/src/App.tsx` for examples.
`persistWorkspace()` writes `.cortex/workspace.json`; keep `leftSidebar` in that snapshot so resize and collapsed state are restored per vault.

Tabs are either `file` or `view`. File tabs may be duplicated with `forceNew`/`newTab`; view tabs carry per-tab serializable `viewState` so plugin views keep state when moved between panes. `dragStore` coordinates `tab`, `file`, and `sidebar-view` drag sources, cursor position for the desktop drag preview, pane edge drops for splits, and tab-bar insertion targets with `insertIndex`.

### uiStore
Manages UI chrome, app-level overlays, and settings entry points:

```typescript
export interface UIState {
  leftSidebarCollapsed: boolean
  leftSidebarWidth: number
  leftSidebarView: string
  settingsOpen: boolean
  settingsInitialSection: string | null

  toggleLeftSidebar: () => void
  setLeftSidebarCollapsed: (collapsed: boolean) => void
  setLeftSidebarWidth: (width: number) => void
  setLeftSidebarLayout: (layout: Partial<LeftSidebarLayout>) => void
  resetLeftSidebarLayout: () => void
  setLeftSidebarView: (view: string) => void
  openSettings: (section?: string) => void
}
```

`LEFT_SIDEBAR_WIDTH_BOUNDS` and `clampLeftSidebarWidth()` are exported with `uiStore`; use them anywhere sidebar width is read from pointer input or restored from persisted state.

`leftSidebarView` accepts dynamic plugin view IDs. The desktop host owns registration lookup and
falls back to `"files"` when the active plugin view disappears.

**Usage**: Prefer selectors such as `useUIStore((s) => s.leftSidebarWidth)` in frequently re-rendered app chrome. Marketplace opening is desktop-owned workspace behavior; do not add Marketplace routing or tab state back to `uiStore`.

### syncStore
Manages the active sync engine state, file sync status, conflicts, and event subscriptions:

```typescript
export interface SyncState {
  engineState: SyncEngineState  // "idle" | "connecting" | "live" | "offline" | "recovering" | "denied"
  syncingFiles: Record<string, string>
  lastSyncedAt: number | null
  error: string | null
  conflicts: Record<string, ConflictInfo>
  vekRequired: boolean
  syncPreferences: SyncPreferences  // includes excludedPaths, ignoreImages, and syncBookmarks

  loadSyncPreferences: (vaultPath: string) => Promise<void>
  saveSyncPreferences: (vaultPath: string, preferences: SyncPreferences) => Promise<void>
  updateSyncPreference: (key, value) => Promise<void>
  toggleExcludedPath: (relativePath, excluded) => Promise<void>
  isPathExcluded: (relativePath) => boolean
  startSync: (vaultId, vaultPath, serverUrl) => Promise<void>
  stopSync: () => Promise<void>
  subscribeEvents: () => Promise<void>   // Listens to Tauri events from Rust engine
  unsubscribeEvents: () => void
}
```

`subscribeEvents()` bridges Rust engine events to Zustand state. It also listens for `sync-log` events from Rust and pipes them into `syncLogStore`. The `onVaultAccessDenied` listener auto-unlinks the vault when a 403 is received.
Sync preferences are vault-scoped in `.cortex/sync-preferences.json`; `excludedPaths` are gitignore-style patterns that may reference paths not currently present in the vault. Use `normalizeSyncPreferences()` and `normalizeSyncPathPattern()` for migration/input cleanup, and `shouldIgnoreSyncPath()` for UI-only checks that mirror Rust ignore behavior. Bookmarks stay local unless `syncBookmarks` is enabled, in which case `.cortex/bookmarks.json` follows the same sync path as other opted-in Cortex metadata.

`sync-file-event` is state-only. Do not read or hash note files from sync event handlers. The native
watcher is the authority for disk mutations, while property schema events invalidate the
framework-free schema subscription without scanning the vault.

**Usage**: `const { engineState, startSync, stopSync } = useSyncStore()`

### syncLogStore
Platform-independent in-memory log buffer (500 entries, FIFO). No platform imports — ready for React Native.

```typescript
export interface SyncLogState {
  entries: SyncLogEntry[]  // { id, timestamp, level, message, metadata? }
  log: (level: SyncLogLevel, message: string, metadata?: Record<string, string>) => void
  clear: () => void
}
```

**Logging responsibility split**:
- **Rust** emits `sync-log` events for all engine-originated logs (state changes, sync errors, conflicts, initial sync). These are bridged to this store via `syncStore.subscribeEvents()`.
- **Frontend** calls `useSyncLogStore.getState().log()` directly only for events it originates (lifecycle start/stop in `useSyncLifecycle.ts`, access denied handling).
- Never duplicate: if Rust already emits a log for an event, the frontend must NOT add its own log call for the same event.

**Usage**: `const { entries, clear } = useSyncLogStore()`

### authStore
Manages authentication state for the active sync server:

- Auth is scoped by normalized `serverUrl`; Cortex Cloud and self-hosted servers must not share tokens.
- `login(email, password, serverUrl)` and `register(..., serverUrl)` authenticate against the vault's configured sync server.
- Auth identity keeps `userId`, email, and an optional persisted display name. UI may derive a
  readable fallback from email, but must not perform a member request just to render the account.
- `logout(allDevices, serverUrl)` stops and disables active sync before clearing only that server
  session. It must not unlink the vault or clear Self-host configuration.

### remoteVaultStore
Manages vault-scoped sync configuration. `syncConfig` is persisted on disk at `vault_path/.cortex/sync-config.json` and includes `enabled`, `remoteVaultId`, `selfHosted`, `serverUrl`, `offlineMode`, and non-secret `selfHostedEnvironment` values. `linkedVaultId` mirrors `syncConfig.remoteVaultId`. `clearLink()` clears memory only; `unlinkVault(path)` clears only the remote vault link from disk and preserves the rest of the sync config.

`setSyncEnabled(path, true)` must confirm the server-scoped auth status before persisting. Self-host
selection and server/environment configuration remain available while signed out; enabling sync
still requires a valid account on the selected server.

### Sync Settings Models

`src/sync` owns framework-free settings data shared with future clients: the typed self-host field
catalog, ordered `.env` serialization, vault-scoped keychain key generation, engine-state labels and
tones, and relative last-sync formatting with an injectable clock. React hooks, native dialogs,
clipboard access, exports, and keychain reads remain desktop adapter responsibilities.
Self-host `.env` serialization must quote and escape values that contain whitespace, comments,
quotes, newlines, or shell interpolation characters. Keep catalog order stable while preserving
secrets as keychain-backed inputs.
Keep the self-host environment catalog aligned with the sync server's minimal production variables.
Expose only the maintainer-facing essentials in the catalog: runtime mode/proxy trust, database URL,
auth secret, and `CORTEX_STORAGE_BACKEND=local|s3|r2`. Advanced server
limits, CORS, pool sizing, retention, and bucket creation policy stay as server defaults unless the
sync server intentionally promotes them to the self-host path. Secret fields must remain
keychain-backed and non-secret values must stay in the vault sync config.

## NoteCache

The `NoteCache` class manages file contents with caching and auto-save:

```typescript
// Access via singleton
import { noteCache } from "@cortex/core"

// Lifecycle
noteCache.start()              // Start auto-save timer
noteCache.stop()               // Stop timer
await noteCache.openTab(path)  // Load file into cache
await noteCache.closeTab(path) // Unload from cache
await noteCache.write(path, content, metadata)  // Write to cache
await noteCache.flush(path)    // Flush to disk

// External content updates (e.g. tag additions from tagsStore)
noteCache.writeExternal(path, content)  // Update cache + notify listeners

// Subscribe to external content changes (for CM6 editor sync)
const unsub = noteCache.onContentChange(path, (newContent) => {
  // Dispatch CM6 transaction to update editor view
})
```

Before each managed save, NoteCache calls `prepareNoteForSave` from `@cortex/properties` so
configured IDs, creation metadata, and last-edited metadata remain canonical.
Filesystem creation metadata is the local fallback. Linked vaults read the device-local sync
metadata snapshot through the platform abstraction; stores and components must not fetch history
or members independently to render system properties.

Note opening is latency-sensitive. `openTab(path)` should start a best-effort preload, `read(path)`
must share any active preload, and initial disk reads should use `platform.fs.readFileSnapshot(path)`
so content, hash, and filesystem metadata arrive through one platform call. Dirty cached entries
remain authoritative until flushed.

External changes are coordinated per path. Keep one active filesystem read, retain only the newest
observed hash, and publish content only when bytes changed. Vault watcher bursts use a 200ms
debounce with one active scan and at most one trailing scan.

**Key features**:
- Reads from disk on `openTab()`
- Auto-saves every 2 seconds while file is open
- Tracks diffs for undo/redo snapshots
- Flushes on app close or explicit call
- `writeExternal()` updates cache and notifies listeners without triggering auto-save
- `onContentChange()` allows components to react to programmatic content changes (e.g. tag edits syncing to the editor)

## Adding a New Store

1. **Create file**: `packages/core/src/stores/myStore.ts`
2. **Define interface**: `export interface MyState { ... }`
3. **Implement store**: Use Zustand + Immer + devtools pattern
4. **Export from index**: Add to `packages/core/src/index.ts`
5. **Use in components**: `const { state, action } = useMyStore()`

Example:

```typescript
// packages/core/src/stores/myStore.ts
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

export interface MyState {
  items: string[]
  addItem: (item: string) => void
  removeItem: (item: string) => void
}

export const useMyStore = create<MyState>()(
  devtools(
    immer((set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          state.items.push(item)
        }),
      removeItem: (item) =>
        set((state) => {
          state.items = state.items.filter((i) => i !== item)
        }),
    })),
    { name: "myStore" },
  ),
)
```

Then export from `packages/core/src/index.ts`:
```typescript
export { useMyStore } from "./stores/myStore"
export type { MyState } from "./stores/myStore"
```

## Store Dependency Graph

Stores **should not directly depend on each other**, but may read state via `get()`:

```
vaultStore (file operations)
  ├─ uses getPlatform() → platform abstraction
  └─ creates and duplicates notes through @cortex/properties defaults

editorStore (editor state)
  └─ no dependencies

workspaceStore (layout)
  ├─ reads vaultStore.vault (for persistence path)
  └─ reads editorStore.activeFilePath (for context)

uiStore (UI chrome)
  └─ no dependencies

templateStore (vault-scoped templates)
  ├─ uses @cortex/templates → safe placeholder rendering
  ├─ uses getPlatform() → .cortex/templates manifest and body files
  └─ creates notes through @cortex/properties defaults

syncStore (sync engine state)
  ├─ uses getPlatform().sync → Tauri sync commands + event listeners
  ├─ imports syncLogStore → bridges Rust sync-log events
  ├─ dynamic imports vaultStore, remoteVaultStore → auto-unlink on access denied
  └─ subscribes to 8 Tauri events (state, file, progress, conflict, complete, vek, log, denied)

syncLogStore (sync log buffer)
  └─ no dependencies (pure in-memory store, platform-independent)

authStore (auth state)
  ├─ uses getPlatform().auth
  └─ dynamic imports syncStore → stopSync on logout

remoteVaultStore (vault-scoped sync config)
  ├─ uses getPlatform().remoteVault → reads/writes sync-config.json
  └─ dynamic imports authStore → checks auth for the configured server URL

tagsStore (tag management)
  ├─ uses getPlatform() → file I/O
  ├─ uses noteCache.writeExternal() when file is open (syncs to editor)
  └─ falls back to platform.fs.writeFile() when file is not cached

noteCache (file cache)
  ├─ uses getPlatform() → file I/O
  └─ triggered by editor/workspace
```

Keep dependencies minimal. If you need state from another store, use `useOtherStore.getState()` inside an action (not in component). Use dynamic imports (`await import("./otherStore")`) to avoid circular dependency issues between sync-related stores.

## Zustand DevTools

In development (via `devtools` middleware):
- Open browser DevTools → Redux tab
- See all store state and actions
- Time-travel debug: click actions to revert state
- Export/import state snapshots

## Testing

Tests live in `src/__tests__/`. Run with:

```bash
bun run --cwd packages/core vitest run
# or from the monorepo root:
bun run test
```

### Mocking `@cortex/platform`

`getPlatform()` must be mocked in every test that touches stores or NoteCache. Add `vi.mock` directly in the test file (not in setup.ts) when you need per-test mock control:

```typescript
const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()

vi.mock("@cortex/platform", () => ({
  getPlatform: vi.fn(() => ({
    fs: {
      readFile: mockReadFile,
      readFileSnapshot: vi.fn().mockResolvedValue({
        content: "",
        hash: "abc123",
        metadata: { createdAt: 0, modifiedAt: 0 },
      }),
      writeFile: mockWriteFile,
      hashFile: vi.fn().mockResolvedValue("abc123"),
      getFileMetadata: vi.fn().mockResolvedValue({ createdAt: 0, modifiedAt: 0 }),
    },
  })),
}))
```

### Resetting Store State Between Tests

Use `setState` to reset stores in `beforeEach`:

```typescript
beforeEach(() => {
  useSyncLogStore.setState({ entries: [], nextId: 0 })
  useEditorStore.setState({ activeFilePath: null, mode: "live-preview", cursor: null })
})
```

### Fake Timers for NoteCache Debounce

NoteCache auto-saves with a 2-second debounce. Use fake timers:

```typescript
vi.useFakeTimers()

noteCache.write("/file.md", "new content", {})
await vi.advanceTimersByTimeAsync(2001) // trigger debounce
expect(mockWriteFile).toHaveBeenCalled()

vi.useRealTimers()
```

### Spying on NoteCache Methods

```typescript
vi.spyOn(noteCache, "flush").mockResolvedValue()
vi.spyOn(noteCache, "openTab").mockResolvedValue()
```

## No Side Effects in Stores

Stores should:
- ✅ Update state
- ✅ Call async platform methods
- ✅ Coordinate with other stores via `get()`
- ❌ No direct DOM manipulation
- ❌ No window.location changes
- ❌ No unrelated side effects

If you need side effects, handle them in components or via useEffect.

## Performance

Zustand uses **shallow comparison** for re-renders:

```typescript
// ✅ Only component using `count` re-renders when count changes
const count = useMyStore((state) => state.count)

// ✅ More selective subscriptions prevent unnecessary re-renders
const { count, increment } = useMyStore((state) => ({
  count: state.count,
  increment: state.increment,
}))

// ⚠️ Less common but valid — whole state
const state = useMyStore()
```

For large stores, consider selector functions to minimize re-renders.

## Building & Debugging

```bash
# Type check
bun run typecheck

# Lint & format
bun run check
bun run check:fix

# Import in app
import { useVaultStore, useEditorStore } from "@cortex/core"
```

Stores are tree-shaken at build time, so importing only what you need is efficient.

## Cortex Cloud Sync Entitlement

`resolveSyncServerUrl(syncConfig)` is the source of truth for the active sync server: Cortex Cloud
uses the build-provided cloud URL, while self-hosted sync uses the vault-scoped `serverUrl`.
`useSubscriptionStore` validates Cortex Cloud entitlement with a short cache and only at workflow
boundaries such as login, enabling sync, linking/creating remote vaults, and opening Sync settings.
Billing CTAs should open the configured web billing URL; core and desktop must not create checkout
sessions.
The billing site owns checkout and redirects back to the open desktop app with
`cortex://sync/checkout-complete`. Treat that deep link only as a prompt to force-refresh Cortex
Cloud subscription status; do not trust it as proof of payment or add checkout creation to core.
Do not add plan checks to file watcher, queue, note save, or per-file sync paths. Self-hosted sync
must not require a Cortex Cloud plan. When the native engine reports a subscription denial, preserve
the remote vault link and queued sync work so renewal can resume without relinking.

## Frontmatter Utilities

`@cortex/properties` owns YAML parsing and targeted frontmatter mutation. `@cortex/core` keeps the
following compatibility facade for tags and existing plugin metadata consumers:

```typescript
import {
  parseFrontmatter,
  createDefaultFrontmatter,
  hasFrontmatter,
  updateFrontmatterField,
  addTagToFrontmatter,
  removeTagFromFrontmatter,
  extractAllTags,
  extractInlineTags,
  extractYamlArray,
} from "@cortex/core"
```

- `parseFrontmatter(content)` — Extracts typed `{ data, body }` from markdown string
- `createDefaultFrontmatter(options?)` — Generates a default YAML block with only `created` unless
  callers pass tags or extra fields explicitly
- `hasFrontmatter(content)` — Checks for a structured YAML frontmatter block
- `updateFrontmatterField(content, key, value)` — Safely updates a single YAML field
- `addTagToFrontmatter(content, tag)` / `removeTagFromFrontmatter(content, tag)` — Tag manipulation
- `extractAllTags(content)` — Returns both YAML frontmatter tags and inline `#hashtags`
- `extractInlineTags(content)` — Extracts only inline `#hashtags` from body
- `extractYamlArray(raw)` — Reads an array from parsed YAML

New property and frontmatter behavior belongs in `@cortex/properties`. `tagsStore` may continue to
use the compatibility facade; other packages should import the canonical properties APIs directly.
NoteCache always stores complete raw notes. Desktop editors project only the Markdown body and
recombine edits with the current cached frontmatter prefix before calling `noteCache.write`.

## Workspace Tab Ownership

- A non-suspended file tab owns exactly one `NoteCache.openTab(filePath)` reference, even when the
  same file is open in duplicate tabs.
- Suspending an inactive file tab releases that one cache reference with `noteCache.closeTab`; a
  suspended tab must not mount editor/cache read hooks until it is reactivated.
- Activating a suspended file tab must reacquire the cache reference before clearing
  `isSuspended`.
- Closing a suspended tab must not call `noteCache.closeTab` again. Closing, replacing, or moving
  away from a non-suspended file tab releases only that tab's own reference.
- Automatic snapshots should skip unchanged duplicates; manual, pre-save, and pre-sync snapshots
  remain explicit history entries even when content matches the previous snapshot.
