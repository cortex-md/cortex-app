# @cortex/core

Platform-neutral app logic shared by desktop and mobile: Zustand stores, `NoteCache`, the vault
index, indexing, runtimes, sync state, templates, and pure utilities. No React DOM, Electron, Node,
or React Native imports; all I/O goes through `getPlatform()` from `@cortex/platform`.

## Stores

- Stores use Zustand (Immer where the store already does). Define the state interface first, keep
  actions inside the store, and select narrow slices in components
  (`useStore((s) => s.field)`), never the whole store in hot UI.
- No DOM, `window.location`, or unrelated side effects inside stores. Lifecycle side effects belong
  in runtimes (`src/runtime`).
- Stores do not import each other reciprocally. Read another store with `getState()` inside an
  action, use the internal runtime bridge for vault path / auth refresh concerns, and use dynamic
  imports between sync-related stores to avoid cycles.
- Remove dormant stores. A store exists only when it is exported and wired into a feature.
- Background failures update a store error field or emit a structured log. No empty `catch`.
- Independent awaits run with `Promise.all`; vault-wide work uses bounded worker pools
  (`mapWithConcurrency`), never one unbounded read per file. Collect first, then apply one coherent
  state update.

## Vault Model

- `vaultStore` owns one `VaultIndex` (`src/vault/vaultIndex.ts`, `getVaultIndex()`): path map,
  sorted children per folder (ordering rule: `getFileNameSortKey` from `@cortex/platform/utils`),
  persistent `FileTreeNode`s, and per-folder versions. It is **patched, never rebuilt**: watcher
  batches and every in-app create/delete/rename/move/duplicate go through `applyFileChanges`; only a
  create without an `entry` (mobile) or an explicit `refreshFiles` rescans (diffed by `replaceAll`).
- Read fresh metadata through `getVaultIndex()`, `useVaultEntry`, `useFolderEntries`,
  `useVaultFileTree`, `useVaultModifiedTime(s)`, `useVaultFolderPaths`, `useVaultEntryLookup`.
  `files` is a compatibility snapshot rebuilt only on structural changes; its `mtime`/`size` can lag.
- Runtimes consume `VaultIndexDelta`s (`subscribeVaultIndexChanges`) instead of diffing `files`.
- `openVault` loads settings, bookmarks, sync preferences, and templates once; app shells never
  reload them. Every vault switch uses `switchVault` / `resolveFolderOpen`.
- `renameFile` / `moveFile` are the authority for renames and moves: they flush the old NoteCache
  path, migrate cache entries, tabs, bookmarks, comments, history, and property UI state, and fail on
  destination collisions. Callers never repeat those updates.
- Creating a note succeeds when the filesystem write succeeds; hashing, metadata, cache priming, and
  indexing are post-create work (retry briefly, then log). Seed created content into `noteCache`
  through the shared clean-note creation helper; deletes forget the path and descendants.
- Path helpers, `VAULT_FILES`, and `mapWithConcurrency` live in `@cortex/platform/utils` and are
  re-exported here; never re-implement them.

## NoteCache

- UI reads and writes notes only through `noteCache`. It always stores the complete raw note;
  editors receive only the Markdown body and recombine edits with the cached frontmatter prefix
  (`openNoteDocumentSession`). Frontmatter never enters CodeMirror.
- `openTab` starts a preload, `read` shares it, and first reads use `fs.readFileSnapshot`. Dirty
  entries stay authoritative until flushed. `write` only marks dirty; flushes are single-flight per
  path, call `prepareNoteForSave` from `@cortex/properties`, and use `writeFileSnapshot`.
- External changes are serialized per path: one active read, keep only the newest observed hash,
  publish only when bytes changed. `onDiskContentChange` lets indexes reuse cached content.
- `mutateNote(path, transform)` is the only read-modify-write path for note text outside the editor
  (tasks, tags, properties, database config). It serializes per path and records local history.
- Live documents (`writeLive`, `attachLiveDocument`) route collaboration content through the cache;
  only local editor edits set `prepare`, which prevents `last_edited` ping-pong between peers.

## Workspace and Tabs

- Restore keeps inactive tabs suspended; only the active file tab per pane calls
  `noteCache.openTab`. A non-suspended file tab owns exactly one cache reference; suspending releases
  it, reactivating reacquires it before clearing `isSuspended`, closing a suspended tab never
  releases twice.
- Non-Markdown tabs (PDF) never touch NoteCache or editor active-file state.
- `openTab(path)` activates an existing tab; `reuseActive` only for sidebar-style navigation.
- Ephemeral view tabs (`openViewTab(..., { ephemeral: true })`) are never persisted. Plugins open
  temporary Markdown only through `api.workspace.openMarkdownTab`.
- Workspace state persists to `.cortex/workspace.json` (debounced by `startAppRuntime`), including
  the left sidebar layout, `quickFinderPreview`, and `recentCommandIds` (`recordRecentCommand`).
- `getRecentFilePaths` is the single "recent notes" order (global `lastAccessed`, then recently
  closed). Use selectors such as `selectActiveTab` instead of inline pane lookups.

## Indexing

- `noteMetadataIndex` (`src/indexing/noteMetadataIndex.ts`) is the only vault-wide note parser: one
  read and one parse per changed note (fingerprint `{mtime, size}`) producing tags (shared
  `@cortex/properties/tags` rule), wiki links, tasks, and frontmatter properties. Persisted as
  `.cortex/cache/notes-index.json`. Extend `NoteMetadata` instead of adding another parser.
- `tagsStore`, `linksStore`, and `tasksStore` are derived views of that index; their build/update
  calls delegate to it. Components select `fileTags[path]`, `tagColors`, `selectSortedTags`.
- `startAppRuntime` runs one idle full pass per vault (search, then metadata — sequential on purpose
  so the metadata parse does not compete with first interactions), then stays incremental.
  Property suggestions read the index through the properties `noteIndex` service.
- Mobile uses `indexing: "lazy"`; databases run in every mode.

## Databases

- `startDatabaseRuntime` finds folder-note candidates through the vault index and loads rows only
  for folders held by `retainDatabase(folder)`, from that folder's children. No vault-wide
  frontmatter scan.
- Row reads use `noteCache.getEntry` for open notes and batched `fs.readTextFiles` otherwise.
  `databaseRowCache.ts` persists rows under `.cortex/cache/database-rows/`; bump `CACHE_VERSION` when
  `createDatabaseRow` output changes.
- Writes go through `databaseActions.ts` (optimistic cell patches with revert, debounced config
  writes, per-folder serialized row creation). Pending writes overlay re-read rows so watcher echoes
  never revert optimistic edits.

## Sync

- `resolveSyncServerUrl(syncConfig)` is the source of truth for the active server. Auth is scoped by
  normalized server URL; Cloud and self-hosted sessions never share tokens.
- Sync config and preferences live in `.cortex/sync.json` (`config` / `preferences`), written through
  `src/sync/syncConfig.ts` and `writeSyncPreferences`. Ignore rules come from
  `@cortex/platform/sync-rules` (the same policy as the sync engine).
- `sync-file-event` handlers are state-only: never read or hash files from sync events. The native
  watcher is the disk authority; `sync.db` is the only source of note sync metadata.
- Sync logs: the engine logs everything it originates; the frontend logs only its own lifecycle
  decisions. Never duplicate a log, never log tokens or secrets.
- Access-denied marks the engine `denied` and never unlinks the vault. Logout stops and disables
  sync for that server only. Enabling sync requires a valid session for the selected server.
- Cortex Cloud entitlement is checked only at workflow boundaries (login, enable, link, Sync
  settings), never in watcher, queue, save, or per-file paths. Self-hosted never needs a plan.
  `cortex://sync/checkout-complete` only triggers a refresh; it is not proof of payment.
- Self-host settings models (`src/sync`) stay framework-free; secrets stay keychain-backed.
- Members, access, invites, and shares load through one overview request per screen; access checks
  use `createAccessEvaluator` (deepest rule wins) and the `canWrite*/canRead*` helpers.

## Local History

- `history/localHistory.ts` keeps versions under `.cortex/history/` (never synced). Capture points
  are the single write paths (autosave at most every 5 min per note, external refreshes, every
  `mutateNote`). Captures are serialized and fire-and-forget; retention is 24 h full, then daily for
  30 days, capped at 200 MB per vault. Renames only rewrite the index.

## Other Domains

- Bookmarks: `.cortex/bookmarks.json`, vault-relative Markdown paths, insertion order, updated
  through vault rename/move/delete flows.
- Tasks: parsed with `@cortex/tasks`; quick-add tasks go to `.cortex/inbox.md`; reminders are
  re-planned by `runtime/tasksRuntime.ts`.
- Comments: one sidecar per note in `.cortex/comments/`; writes re-read, re-apply, and write
  atomically through a per-file queue.
- Templates (`@cortex/core/templates`): pure, deterministic, no user JavaScript, safe relative body
  paths; `formatTemplateDate` is the single date formatter.
- Onboarding content and markers live in `src/onboarding`; the first-run marker is written once any
  vault is open or registered.
- Frontmatter: new property behavior belongs in `@cortex/properties`; core keeps a compatibility
  facade (`parseFrontmatter`, tag helpers). `@cortex/core/frontmatter` and
  `@cortex/core/bookmark-paths` stay store-free for the mobile WebView realm.
- Wiki links: resolve with `createWikiLinkResolver`; `#Heading` and `#^block` subpaths open the note.

## Testing

- Mock `@cortex/platform` per test file (`vi.mock`) with the full contract the code under test
  touches (for `app`: `getCurrentAppVersion`, `openExternalUrl`, `resolveFileAssetUrl`).
- Reset stores with `setState` in `beforeEach`; use fake timers for the 2 s NoteCache debounce.
- Test data integrity (index deltas, cache ownership, migrations, sync rules), not UI wiring.
