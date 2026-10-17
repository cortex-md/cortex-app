# Vault Data Model

How Cortex keeps the file list, the note indexes, and its own state in memory and on disk. Users
see the same layout in the website docs (`apps/web/src/content/docs/workspace/vault-folder.mdx`).

## Files: `VaultIndex`

`packages/core/src/vault/vaultIndex.ts` is the single in-memory model of the vault's files, owned
by `vaultStore`.

- **What it holds:** entries by path, each folder's children kept sorted, tree nodes for the
  sidebar, modification times, and the database view notes.
- **Sorting:** one rule, `compareFileEntryNames` in `@cortex/platform/utils`. Folders come first,
  names compare naturally (2 before 10), ignoring case and accents.
- **Updates:** apply patches, never rescan. Every `apply`, `replaceSubtree`, or `replaceAll`
  returns a `VaultIndexDelta` (added, removed, modified, changed folders). Unchanged folders keep
  the same node objects, so React rows don't re-render.
- **Write paths:**
  - App actions (create, delete, rename, move, duplicate, daily note, database actions) patch the
    index with their result.
  - Watcher events are batched for 200 ms (`processWatcherBatch` in `vaultStore.ts`).
  - A folder that appears from outside the app is scanned on its own.
  - A full `scanVault` runs only on vault open or an explicit `refreshFiles`.
- **Reading it:** use the hooks in `vaultIndexHooks.ts` (`useVaultEntry`, `useFolderEntries`,
  `useVaultFileTree`, `useVaultModifiedTime`). `vaultStore.files` is a compatibility array, rebuilt
  only on structural changes, so its `mtime` can lag after a save.
- **File kinds:** `getFileKind` in `@cortex/platform/utils` (`note`, `pdf`, `image`, `other`) is
  the only rule. The tree icons, the Quick Finder, and the sync image filter all use it.

Consumers that need to react to changes subscribe to the deltas instead of diffing `files`. The
sidebar, the database runtime, and app indexing do this, on desktop and mobile.

## Note metadata: `noteMetadataIndex`

`packages/core/src/indexing/noteMetadataIndex.ts` reads and parses each changed note once.

- **Output:** tags, wiki links, tasks, and frontmatter properties per note.
- **Change detection:** a note counts as changed when its `{ mtime, size }` fingerprint changes.
- **Persistence:** `.cortex/cache/notes-index.json`, written atomically with a 5 s debounce.
- **Consumers:** `tagsStore`, `linksStore`, and `tasksStore` are derived views with stable
  selectors. Property suggestions read it through the `noteIndex` service of
  `@cortex/properties`.
- **Tag rule:** inline tags use the single rule in `@cortex/properties/tags`, the same one Live
  Preview and Reading View use to decorate tags. Change it there, never in a consumer.

## Search

`@cortex/search` wraps MiniSearch. On desktop it runs in a Web Worker
(`apps/desktop/src/features/search/searchWorkerBackend.ts`).

- **Persistence:** `.cortex/cache/search-index.json` stores per-document fingerprints and is
  written with a 5 s debounce.
- **Snippets:** the worker builds the Quick Finder's text matches, so the renderer never parses
  Markdown for them.

On vault open, `appRuntime` runs search indexing first and the metadata index second, in an idle
callback. They run in sequence on purpose: the metadata load parses on the renderer thread, and
running both together made the first Quick Finder open much slower at 50k notes. After that,
indexing is incremental and driven by `VaultIndex` deltas and NoteCache writes.

## Notes in memory: NoteCache

`packages/core/src/noteCache.ts` holds the content of open and recently read notes. It handles
autosave (2 s debounce), external changes, renames, and snapshots. Unused entries with no open tab
are evicted after 15 minutes.

## State files

Small JSON state goes through one engine, `getStateFile` in `packages/platform/src/stateFile.ts`,
re-exported from `packages/core/src/vault/vaultStateFiles.ts`.

- There is one cached instance per path, and updates apply in order.
- Writes are serialized, debounced, and atomic (`fs.atomicWriteFile`).
- On write, the engine re-reads the file and replaces only the top-level keys this process changed,
  so the mobile native side and its WebView can share `local.json`.
- `closeVault` flushes and closes every state file of the vault.

Use it for any new vault state instead of reading and writing JSON by hand.

## `.cortex` layout

File names live in `VAULT_FILES` (`packages/platform/src/utils.ts`), and sync rules live in
`packages/platform/src/sync-rules.ts`.

| File | Holds | Syncs |
| --- | --- | --- |
| `vault.json` | Identity (`id`, `name`, `createdAt`), read once in `openVault` | Never |
| `local.json` | Device-only state: tag colors, search history, enabled plugins, panel state, extension sync memory | Never |
| `sync.json` | Sync link (`config`) and preferences | Never |
| `app.json`, `hotkeys.json`, `workspace.json`, `bookmarks.json` | Settings, shortcuts, layout, bookmarks | Opt-in, one flag each |
| `plugins.sync.json`, `themes.sync.json` | Installed extensions for extension sync (`packages/marketplace/src/extensionSync`) | Opt-in |
| `schema/properties.json`, `inbox.md`, `comments/` | Property schema, task inbox, comment threads | Always |
| `templates/`, `plugins/`, `themes/` | Templates and installed extension files | Never |
| `history/`, `sync.db`, `cache/` | Local history, sync engine state, rebuildable indexes | Never |

There is no migration from older layouts. A `vault.json` that cannot be read is an error; Cortex
never mints a new id in its place. Settings that must be identical on every device belong in a
synced file; device-only state belongs in `local.json`.
