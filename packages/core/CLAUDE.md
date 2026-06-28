# CLAUDE.md — @cortex/core

This file provides guidance to Claude Code (claude.ai/code) when working with state management in the Cortex core package.

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
  } catch (_e) {}  // Silently ignore errors
}
```

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

  openVault: (path: string, options?: { icon?: string; color?: string; name: string }) => Promise<void>
  closeVault: () => Promise<void>
  refreshFiles: () => Promise<void>
  loadRecentVaults: () => Promise<void>  // Also refreshes macOS menu recents
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
Manages the layout (split panes, tabs, their positions):

```typescript
export interface WorkspaceState {
  splitTree: SplitTree                    // Recursive layout tree
  panes: Map<PaneId, Pane>               // All panes by ID
  activePaneId: PaneId | null            // Currently focused pane
  // ... + many layout actions

  resizeSplit: (nodeId: string, delta: number) => void
  closeTab: (paneId: PaneId, tabIndex: number) => void
  goToTabIndex: (paneId: PaneId, tabIndex: number) => void
  loadWorkspace: (vaultPath: string) => Promise<void>
  persistWorkspace: (vaultPath: string) => void
}
```

**Usage**: Complex layout operations. See `apps/desktop/src/App.tsx` for examples.

### uiStore
Manages UI chrome, app-level overlays, and settings entry points:

```typescript
export interface UIState {
  leftSidebarCollapsed: boolean
  leftSidebarWidth: number
  leftSidebarView: "files" | "search" | "bookmarks" | "tags"
  settingsOpen: boolean
  settingsInitialSection: string | null

  toggleLeftSidebar: () => void
  setLeftSidebarWidth: (width: number) => void
  setLeftSidebarView: (view: string) => void
  openSettings: (section?: string) => void
}
```

**Usage**: `const { leftSidebarWidth, setLeftSidebarWidth } = useUIStore()`. Marketplace opening is desktop-owned workspace behavior; do not add Marketplace routing or tab state to `uiStore`.

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
  syncPreferences: SyncPreferences

  startSync: (vaultId, vaultPath, serverUrl) => Promise<void>
  stopSync: () => Promise<void>
  subscribeEvents: () => Promise<void>   // Listens to Tauri events from Rust engine
  unsubscribeEvents: () => void
}
```

`subscribeEvents()` bridges Rust engine events to Zustand state. It also listens for `sync-log` events from Rust and pipes them into `syncLogStore`. The `onVaultAccessDenied` listener auto-unlinks the vault when a 403 is received.

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
Manages authentication state and account lifecycle:

- `logout()` stops sync first, then clears auth tokens, then unlinks the vault from disk (not just memory)
- `login()` unlinks any existing vault link to prevent stale remote vault references

### remoteVaultStore
Manages remote vault linking. `linkedVaultId` is persisted on disk at `vault_path/.cortex/sync-config.json`. `clearLink()` clears memory only; `unlinkVault(path)` clears both memory and disk.

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
  └─ createFile() auto-generates default frontmatter (created + tags)

editorStore (editor state)
  └─ no dependencies

workspaceStore (layout)
  ├─ reads vaultStore.vault (for persistence path)
  └─ reads editorStore.activeFilePath (for context)

uiStore (UI chrome)
  └─ no dependencies

syncStore (sync engine state)
  ├─ uses getPlatform().sync → Tauri sync commands + event listeners
  ├─ imports syncLogStore → bridges Rust sync-log events
  ├─ dynamic imports vaultStore, remoteVaultStore → auto-unlink on access denied
  └─ subscribes to 8 Tauri events (state, file, progress, conflict, complete, vek, log, denied)

syncLogStore (sync log buffer)
  └─ no dependencies (pure in-memory store, platform-independent)

authStore (auth state)
  ├─ uses getPlatform().auth + keychain
  └─ dynamic imports syncStore, vaultStore, remoteVaultStore → stopSync + unlinkVault on logout

remoteVaultStore (vault linking)
  └─ uses getPlatform().remoteVault → reads/writes sync-config.json

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
      writeFile: mockWriteFile,
      hashFile: vi.fn().mockResolvedValue("abc123"),
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

## Frontmatter Utilities

`@cortex/core` exports centralized frontmatter utilities from `src/utils/frontmatter.ts`:

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
- `createDefaultFrontmatter(options?)` — Generates default YAML block with `created` timestamp and `tags: []`
- `hasFrontmatter(content)` — Quick regex check
- `updateFrontmatterField(content, key, value)` — Safely updates a single YAML field
- `addTagToFrontmatter(content, tag)` / `removeTagFromFrontmatter(content, tag)` — Tag manipulation
- `extractAllTags(content)` — Returns both YAML frontmatter tags and inline `#hashtags`
- `extractInlineTags(content)` — Extracts only inline `#hashtags` from body
- `extractYamlArray(raw)` — Parses YAML-style arrays (inline `[a, b]` or block `- item`)

All other packages (`@cortex/search`, `tagsStore`, etc.) should import from here instead of writing inline frontmatter parsers.
