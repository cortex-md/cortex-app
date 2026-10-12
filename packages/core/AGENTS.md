# AGENTS.md — @cortex/core

This file provides guidance to Codex when working with state management in the Cortex core package.

## Purpose

`@cortex/core` exports:
- **Zustand stores** — React hooks for global state (vaultStore, editorStore, workspaceStore, uiStore)
- **NoteCache** — In-memory file cache with auto-save and snapshots
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
It reuses the in-memory index for the same vault (or `.cortex/tags-index.json` on first open) and
avoids reopening unchanged notes. Incremental `updateFileInIndex`/`removeFileFromIndex` calls keep the
persisted index current. Components read sorted tags through `useTagsStore(selectSortedTags)`.
The active workspace tab is read with `useWorkspaceStore(selectActiveTab)` or
`useWorkspaceStore(selectActiveTabFilePath)` instead of inline pane lookups.
NoteCache external-change loads should continue until the latest observed hash has been processed,
but still process one hash at a time per path.
Independent platform reads inside one step, such as reading file contents and hashing the same file,
may run through `Promise.all` when neither result affects whether the other call should happen.
For remote sync/member mutations, run independent entitlement and auth-refresh checks together, then
perform the mutation only after both have completed.

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
Bookmark path rules (`normalizeBookmarkPath`, and `requireBookmarkPath` for the plugin-facing errors)
live in the pure `utils/bookmarkPaths.ts`.

### Sync History Presentation

`sync/logPresentation.ts` maps raw sync log entries (`Pushed:`, `Pulled:`, `Conflict detected:`,
`Sync state:` …) to `SyncLogPresentation` (kind, tone, title, paths, detail), aggregates bursts of
transfers into one item, and groups items by "Just now", "Earlier today", "Yesterday" or date.
`utils/textDiff.ts` is the framework-free diff used by history surfaces: Myers line diff with a
cost guard, similarity-paired word diffs, folded unchanged lines with stable row ids, and
`countWordChanges` for version deltas. Keep both pure so mobile can reuse them.
`vaultStore.createFileWithContent` creates a uniquely named note with given content.

### Tasks and Reminders

`tasksStore` indexes Markdown checkbox tasks with the pure rules from `@cortex/tasks`, following the
`linksStore` pattern: a versioned `.cortex/tasks-index.json` (local, never synced) keyed by file
fingerprints, fed by `indexNoteContent`/`removeIndexedPath` in `runtime/appRuntime.ts`. Quick-add
tasks are appended to `.cortex/inbox.md` (`VAULT_FILES.taskInbox`), which is always synced and is
reloaded on `sync.onFileEvent` because the vault watcher ignores `.cortex`. All task mutations go
through one line rewrite on top of `notes/mutateNote.ts` and return a `TaskLineEdit` that
`revertTaskEdit` can undo.

`mutateNote(path, transform)` is the only read-modify-write path for note text outside the editor:
it serializes writes per path, reads from `noteCache` when the note is open, and writes through
`noteCache.writeExternal` or `fs.atomicWriteFile`. Tasks, tags, properties (`notes.updateNote`), and
database config writes use it, so concurrent edits to the same note cannot drop each other.
`runtime/tasksRuntime.ts` re-plans reminders with `planReminders` whenever tasks or the `tasks`
settings change (debounced, plus a periodic re-plan) and replaces the platform queue through the
optional `notifications.schedule(vaultPath, …)`; notification actions arrive on
`notifications.onActivation`, wait until the vault and task index are ready, and apply
`applyTaskNotificationAction` from `@cortex/tasks` (shared with the Electron main process). Both only run with eager
indexing, so mobile (`indexing: "lazy"`) is unaffected until its adapter schedules notifications.

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
  switchVault: (path: string, options?: OpenVaultOptions) => Promise<void> // close + open, no-op for same path
  resolveFolderOpen: (folderPath: string) => VaultRegistryEntry | null    // registered vault for a picked folder
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

`openVault` loads settings (through `useSettingsStore.loadSettings`), bookmarks, sync preferences,
and templates once; app shells must not reload them. Every vault switch call site uses
`switchVault`/`resolveFolderOpen` instead of composing `closeVault` + `openVault`.

Watcher events are batched (200ms) and serialized. `files` changes only for structural events:
unknown `created` paths trigger one rescan, `deleted` paths are removed in place, and `modified`
events never touch `files`. After each batch, `subscribeVaultFileChanges` listeners receive the
changes; open notes are refreshed through NoteCache's per-path external-change flow.

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

  toggleLeftSidebar: () => void
  setLeftSidebarCollapsed: (collapsed: boolean) => void
  setLeftSidebarWidth: (width: number) => void
  setLeftSidebarLayout: (layout: Partial<LeftSidebarLayout>) => void
  resetLeftSidebarLayout: () => void
  setLeftSidebarView: (view: string) => void
  openSettings: (section?: string) => void  // opens the native Settings window via getPlatform().window
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
  subscribeEvents: () => Promise<void>   // Listens to sync engine events forwarded by the main process
  unsubscribeEvents: () => void
}
```

`subscribeEvents()` bridges sync engine events to Zustand state. It also listens for `sync-log` events from the engine and pipes them into `syncLogStore`. The `onVaultAccessDenied` listener marks the engine `denied` and records the reason; it never unlinks the vault. The UI offers Retry and Unlink.
Sync preferences are vault-scoped in `.cortex/sync-preferences.json`; `excludedPaths` are gitignore-style patterns that may reference paths not currently present in the vault. Use `normalizeSyncPreferences()` and `normalizeSyncPathPattern()` for migration/input cleanup, and `shouldIgnoreSyncPath()` for UI checks; these are re-exported from `@cortex/platform/sync-rules`, the same policy the sync engine uses. Bookmarks stay local unless `syncBookmarks` is enabled, in which case `.cortex/bookmarks.json` follows the same sync path as other opted-in Cortex metadata.

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
- **The sync engine** emits `sync-log` events for all engine-originated logs (state changes, sync errors, conflicts, initial sync). These are bridged to this store via `syncStore.subscribeEvents()`.
- **Frontend** calls `useSyncLogStore.getState().log()` directly only for events it originates (lifecycle start/stop in `runtime/appRuntime.ts` `startSyncLifecycle`, access denied handling).
- Never duplicate: if the engine already emits a log for an event, the frontend must NOT add its own log call for the same event.

**Usage**: `const { entries, clear } = useSyncLogStore()`

### authStore
Manages authentication state for the active sync server:

- Auth is scoped by normalized `serverUrl`; Cortex Cloud and self-hosted servers must not share tokens.
- `login(email, password, serverUrl)` and `register(..., serverUrl)` authenticate against the vault's configured sync server.
- Auth identity keeps `userId`, email, and an optional persisted display name. UI may derive a
  readable fallback from email, but must not perform a member request just to render the account.
- `logout(allDevices, serverUrl)` stops and disables active sync before clearing only that server
  session. It must not unlink the vault or clear Self-host configuration.
- `login`/`register` resolve to the one-time recovery key (or `null`) returned by the platform when
  identity keys were just created; the UI shows it once. `resetPassword(serverUrl, token,
  newPassword, recoveryKey)` completes a `cortex://reset-password` link.

### accountStore
Server account state for the active sync server: `ensureCapabilities(serverUrl?)` caches
`/meta/v1/capabilities` per server (`useServerCapabilities()` reads it for the current sync config),
`fetchOverview()` loads profile and devices (with per-vault last sync) in one request, and profile,
email, password and avatar mutations. UI hides features the server turned off from capabilities.
`loadKeyStatus()` caches `keyStatus` (kdf version, local identity, recovery, fingerprint);
`setupKeys(password)` creates or unlocks the identity for legacy sessions and
`regenerateRecoveryKey()` returns a new recovery key to show once.

### accessStore
Effective path access of the running sync session. `syncStore` seeds it with `sync.getAccess()` after
start and follows `onAccessChanged`. A `null` from the engine (session closed, denied, worker exit)
keeps the last known access for the same vault; `resetAccess()` runs on vault close and unlink.
`null` with no prior access (local or never synced) means full access. `src/sync/access.ts` `createAccessEvaluator` implements the deepest-match rule (`all`
→ edit; deepest covering rule wins, folder rules end with `/`; otherwise `base`) and memoizes per
path; `canWritePath`/`canReadPath`/`levelForPath` take vault-relative paths; `canWriteVaultPath`,
`canReadVaultPath`, `useCanWriteVaultPath`, and `useCanReadVaultPath` take absolute paths. Tag and
property writers assert edit access (bulk tag rename skips unwritable files). `vaultStore` mutations, `templateStore`
note creation, `getFileEntryActions` and `canMoveEntryTo` refuse or hide writes where access is
below edit. `findAccessRule`/`findInheritedRestriction` read `membersStore.accessRules` for the
management UI.

### membersStore
`fetchOverview(vaultId)` loads members (with avatars and key state), groups, access rules (admins
only), presence, invites and member devices in one request; prefer it over separate loads and never
request per row. It refetches automatically when the effective access changes. Groups use
`createGroup`/`updateGroup`/`deleteGroup`; access uses `setAccessRule` (a rule with
`restricted: false` and no entries deletes it). Guests' accessible paths are their user entries.
`createInvite` accepts `{ grants }` for guests and returns the invite (its `inviteUrl` may include
the `#k=` key fragment).
`acceptInviteLink(token, linkKey)` joins from a `cortex://invite/{token}#k=...` link.

### noteSharesStore
Public links of the linked vault keyed by vault-relative path: `fetchShares`, `publish(vaultId,
path, bundle, expiresAt?)`, `updateExpiry`, `revoke`. Bundles are built by the desktop renderer.

### remoteVaultStore
Manages vault-scoped sync configuration. `syncConfig` is persisted on disk at `vault_path/.cortex/sync-config.json` and includes `enabled`, `remoteVaultId`, `selfHosted`, `serverUrl`, `offlineMode`, and non-secret `selfHostedEnvironment` values. `linkedVaultId` mirrors `syncConfig.remoteVaultId`. `clearLink()` clears memory only; `unlinkVault(path)` clears only the remote vault link from disk and preserves the rest of the sync config. Reads and writes go through `src/sync/syncConfig.ts` (`readSyncConfig`, `updateSyncConfig`, `linkRemoteVault`, `unlinkRemoteVault`, one `createDefaultSyncConfig`) over `getPlatform().fs`; platform adapters do not implement sync-config methods.

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
observed hash, and publish content only when bytes changed.

`write()` only marks the entry dirty; the content-to-disk comparison happens once per flush. Flushes
are single-flight per path, re-prepare when content changed during `prepareNoteForSave`, and use
`FileSystem.writeFileSnapshot` (hash + metadata from the same write) with a write/hash/metadata
fallback. `onDiskContentChange` fires after a flush or an external reload so indexes reuse cached
content instead of rereading disk.

**Key features**:
- Reads from disk on `openTab()`
- Auto-saves every 2 seconds while file is open
- Tracks diffs for undo/redo snapshots
- Flushes on app close or explicit call
- `writeExternal()` updates cache and notifies listeners without triggering auto-save
- `onContentChange()` allows components to react to programmatic content changes (e.g. tag edits syncing to the editor)

### Live Documents

- `writeLive(path, raw, { persist, prepare, notify })` updates a cached note from a live Yjs
  document. `persist` marks it dirty for the normal 2 s autosave; `prepare` keeps
  `prepareNoteForSave` for that save (only local editor edits set it, which prevents
  `last_edited` ping-pong between peers); `notify` defaults to true.
- `attachLiveDocument(path, { applyExternalContent })` routes disk changes for that path into the
  live document instead of overwrite/conflict handling; `hasLiveDocument` makes
  `NoteDocumentSession.updateBody` skip its write. `restoreDiskContent` drops unsaved viewer
  content, and `onPathChange` reports renames and forgotten paths.

## App Runtime

`startAppRuntime(options)` (from `src/runtime/appRuntime.ts`) is the shared desktop/mobile lifecycle:
NoteCache start/stop, vault session (tag colors, workspace load + debounced persistence, resets on
close) and indexing. Indexing runs one idle full pass per vault, then stays incremental: `files`
diffs queue added/removed notes, watcher `modified` events reindex uncached notes, and NoteCache disk
events reindex open notes. App shells pass platform hooks (`onVaultOpened`, `onWorkspaceRestored`,
`scheduleIdleWork`) instead of subscribing React roots to `files`. Options: `persistWorkspace`
(default true; mobile passes false), `trackActiveFile` (default true: mirrors the active pane's
active Markdown tab into `editorStore.activeFilePath`, including renames/moves, so apps never call
`setActiveFile` manually), and `indexing: "eager" | "lazy"` (mobile is `lazy` and skips search/tag
indexing until it has a search screen). `startSyncLifecycle()` owns the `canStartSync` rule and is
started by the desktop shell only.

`runtime/appStartup.ts` owns startup for every app: `bootstrapApp()` loads app info, the first-run
marker, recent vaults and global settings; `openLastVault()` opens `resolveStartupVault(...)` (the
registry's most recent vault when `settings.general.autoOpenLastVault`), closes partial state and
throws on failure. The first-run marker has one rule: it is written once any vault is open or listed
in the registry. `flushPendingWrites()` flushes NoteCache and the active editor (desktop
`beforeunload` and update install, mobile `AppState` background/inactive).

`runtime/vaultSession.ts`: `openVaultSession(path, options)` (switch + throw on failure),
`getRegistryOpenOptions(entry)`, `resolvePickedFolder(path)` (registry hit or new folder with the
default name from `vault.openVault` metadata), `createVaultFromFolder(path, { name, icon,
syncPreferences })`, `DEFAULT_VAULT_NAME`, and
`consumePendingOnboardingNote(open)`.

`runtime/fileActions.ts`: `createFileCommandEntries({ openFile })` returns the shared `file.new`,
`file.duplicate`, `file.delete` (platform confirm) and `navigate.daily-note` `CommandEntry`s; apps
register them in their command owner and execute ids. `getFileEntryActions(target)` is the single
rename/move/duplicate/delete catalog for desktop menus and mobile sheets (rename/move are hosted by
the app UI). `vaultStore.deleteFile` closes tabs under the deleted path. `reportAppError` and
`getErrorMessage` live in `utils/reportAppError.ts`.

`openNoteDocumentSession(filePath, { onChange })` is the shared editor document model: it projects
frontmatter once per frontmatter change, `updateBody` recombines the cached frontmatter prefix with
the body, writes through NoteCache, and marks tabs dirty without parsing YAML per keystroke.
`snapshot.revision` increments only when the body changes from outside the editor.
`updateBody(body, { baseRevision })` returns `false` without writing when `baseRevision` is older
than the current revision (an editor commit based on a stale external body); hosts that commit
asynchronously (mobile DOM bridge) pass it and surface the rejection. Desktop commits synchronously
and omits it.

`initializeCoreProperties({ deviceType })` builds the single properties runtime used by desktop and
mobile. Path helpers (`getParentPath`, `getBaseName`, `getNoteTitle`, `toVaultRelativePath`,
`isPathOrDescendant`, …), `VAULT_FILES`, and `mapWithConcurrency` live in `@cortex/platform/utils`
and are re-exported here; never re-implement them. Pure file tree projection lives in
`utils/fileTree.ts`, including `createFileTreeViewModel` (rows, titles, folder paths, all-expanded),
`getFileTreeNodeTitle`, and the move rules `canMoveEntryTo`/`getMoveDestinations`. Entry name rules
(`validateEntryName`, `getEditableEntryName`, `toEntryFileName`) live in `utils/fileName.ts`.

### Live Collaboration Runtime

- `startAppRuntime` starts `collab/collabRuntime.ts`, which stays idle until a note is retained.
  `retainCollabNote`/`useCollabNote(filePath, visible)` check the linked vault, sync enabled and
  online, signed-in user, read access, a note under 1 MiB, and `platform.collab.availability`
  before lazily importing `@cortex/collab` and `collab/collabPersistence.ts`.
- Rooms are the linked remote vault id plus the vault-relative path; parts come from
  `collab/noteParts.ts` (`locateFrontmatter`). Vault, link, sync, or user changes close all
  sessions; `noteCache.onPathChange` renames or closes them.
- `collabPersistence` composes the Y parts once per microtask and calls `writeLive` with
  `persist = canWrite`, `prepare` only for editor origins, and `notify` only for non-editor
  origins. Cache content changes (properties, prepare-on-save, disk) flow back into Y with
  `EXTERNAL_ORIGIN` for writers only. Viewers never persist and restore disk content on close.
- `useCollabNoteState` returns `{ binding, snapshot }` from `useSyncExternalStore`; `binding` is
  stable per document and non-null only after the first reconcile while the session is usable.

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
  ├─ uses getPlatform().sync → sync IPC methods + event listeners
  ├─ imports syncLogStore → bridges engine sync-log events
  ├─ dynamic imports vaultStore, remoteVaultStore → auto-unlink on access denied
  └─ subscribes to 8 sync events (state, file, progress, conflict, complete, vek, log, denied)

syncLogStore (sync log buffer)
  └─ no dependencies (pure in-memory store, platform-independent)

authStore (auth state)
  ├─ uses getPlatform().auth
  └─ dynamic imports syncStore → stopSync on logout

remoteVaultStore (vault-scoped sync config)
  ├─ uses sync/syncConfig.ts (getPlatform().fs) → reads/writes sync-config.json
  ├─ uses getPlatform().remoteVault → remote vault HTTP (create/list/get/update/delete)
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

Pure, store-free subpaths for realms that must not load the stores (the mobile workspace WebView):
`@cortex/core/frontmatter` (`utils/frontmatter.ts`) and `@cortex/core/bookmark-paths`
(`utils/bookmarkPaths.ts`). Keep both free of store, NoteCache, and platform-instance imports.

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

## Navigation, Links, Outline, and Tag Pages

- `workspaceStore.navigation` keeps one back/forward history per pane through the pure helpers in
  `utils/navigationHistory.ts`. Every action that activates a tab records it; `navigateHistory`
  restores a location without recording it again.
- `closeOtherTabs(tabId, paneId, scope)` owns "close others" and "close to the right".
- `useLinksStore` indexes outgoing wiki links with the `tagsStore` pattern (`.cortex/links-index.json`,
  fingerprints, incremental updates from `appRuntime`). Resolve targets with
  `createWikiLinkResolver(files, vaultPath)` and derive backlinks with `selectBacklinks`; open links
  with `openWikiLink`, which creates the note when no target exists.
- `editorStore.updateDocument(filePath, body)` derives word count and headings for the active note;
  read them through `selectActiveDocument`. `requestReveal`/`openNoteAtLine` ask the editor host to
  scroll to a line.
- `utils/tagHierarchy.ts` builds nested tag trees and tag page models; `tagsStore.renameTag` rewrites
  frontmatter and inline tags (including nested `parent/child` tags) and moves tag colours.
- `utils/time.ts` formats relative times and normalizes `FileEntry.mtime` (seconds) to milliseconds.

## Databases

- `startDatabaseRuntime` runs in every indexing mode (mobile included). It finds folder-note
  candidates from `useVaultStore.files`, reads only new or changed candidates, and loads rows only for
  folders held through `retainDatabase(folder)`. Do not add a vault-wide frontmatter index for it.
- Row reads use `noteCache.getEntry` or `readFileSnapshot`, never `noteCache.readEntry`.
- Write through `databaseActions.ts`: `updateDatabaseCell` patches the row optimistically and reverts
  on failure, `updateDatabaseConfig` debounces the view-note write and flushes on release,
  `createDatabaseRow`/`createDatabase`/`convertFolderToDatabase` create files in one write each.
  `createDatabaseRow` is serialized per folder so concurrent creates never pick the same file name.
- `databaseWrites.ts` tracks pending config and cell writes. The runtime keeps the store config while
  a config write is pending and overlays pending cell values on re-read rows, so watcher echoes never
  revert optimistic edits. `loadRows` is coalesced per folder and skips rows updated mid-read.
- Folders keep receiving row updates after release while their rows stay cached, so reopening a
  database never shows stale values.
- `removeDatabase` only removes the `database` key; the folder note is deleted only when nothing else
  remains in it. `vaultStore.renameFile`/`moveFile` flush pending config writes first, and a row
  rename updates `view.order` entries.
- `vaultStore.renameFile` renames a database folder note with its folder. `workspaceStore` keeps view
  tabs whose `viewState.filePath` points inside a renamed or deleted path in step.
- `convertFolderToDatabase` repairs a folder whose view note was renamed outside Cortex: it renames the
  first direct child that still has a `database` key back to `Folder/Folder.md` before creating one.
- Row templates are saved with `saveDatabaseRowTemplate` into `config.templates` and removed with
  `removeDatabaseRowTemplate`.

## Comments and Mentions

- `useCommentsStore` keeps one `CommentsFile` per absolute note path for the open vault. Every write
  applies a pure `@cortex/comments` operation optimistically, then re-reads the sidecar, applies the
  same operation, and writes it with `atomicWriteFile` through a per-file serial queue, so a sync
  that landed in between is never overwritten. An empty file deletes the sidecar.
- `getCommentAuthorId()` returns the signed-in user id on remote vaults and `LOCAL_AUTHOR_ID`
  otherwise. `focusedThreadId`, `draft`, `anchorRanges`, and `revealRequest` coordinate the editor
  and the Comments panel.
- `vaultStore` moves sidecars in `migrateVaultPathReferences` (files and folders) and removes them in
  `deleteFile`.
- `startCommentsRuntime` (part of `startAppRuntime`) watches `.cortex/comments` with its own
  `startWatching(..., { includeHidden: true })` (the vault watcher hides `.cortex`) and reloads
  sidecars on those events and on applied sync events, debounced per file, sends
  native notifications for new mentions and replies (`diffIncomingMessages`, only messages created
  after the runtime started) and for new `@[[Name]]` mentions of the current user in synced notes. It
  respects `tasks.mentionsEnabled`, quiet hours, and `tasks.sound`. Activations with
  `payload.kind === "comment"` open the note and focus the thread, and `actionId: "reply"` posts the
  inline reply. `resolveCommentMentions` maps comment text to member ids.
