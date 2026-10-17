# @cortex/search

## Performance

- The MiniSearch engine, its fingerprints, and the persisted index live behind the async
  `SearchBackend` contract (`src/backend.ts`, also exported as `@cortex/search/backend`):
  `load(persistedIndex)`, `planIndex(entries)`, `addDocuments`, `removePaths`, `search`,
  `searchTitles`, `serialize`, `clear`. `createLocalSearchBackend()` is the in-process
  implementation (default, used by tests and mobile). Hosts swap it with `setSearchBackend(...)`
  before the runtime starts; desktop runs the same local backend inside a Web Worker. Keep the
  contract structured-clone friendly (plain data, strings, no functions) and keep this package free
  of DOM and worker APIs. The store does all IO; the backend never touches the platform.
- Backend calls are processed in order, so store code may fire-and-forget mutations and rely on a
  later `search` seeing them. Guard every mutation with the store generation checks
  (`indexVaultGeneration`, `indexedVaultPath`) so a cancelled pass or a previous vault never writes
  into the current engine.
- Vault indexing: on the first pass for a vault the store reads `.cortex/cache/search-index.json` as text
  and hands it to `backend.load` (the JSON parse happens in the backend, off the desktop main
  thread). `planIndex` prunes ids that are no longer Markdown files and returns the stale ids
  (missing or fingerprint mismatch). Stale notes are read with `fs.readTextFiles` in batches of 200
  and posted with `addDocuments` while the next batch is read; unreadable notes are removed. Do not
  hold the whole corpus in memory at once.
- Keep full stripped Markdown content indexable for search correctness, but never store note bodies
  or previews in MiniSearch `storeFields` or serialized indexes. Snippets and excerpts are computed
  on demand by the backend (`matchNotes`, `readNoteExcerpts`), so frontmatter stripping, Markdown
  stripping, and match building run inside the desktop worker. The backend keeps a small LRU of
  stripped note text, invalidated by `addDocuments`, `removePaths`, `load`, and `clear`; a note it
  has not cached comes back as `{ status: "missing" }` and the store reads those notes in one
  `fs.readTextFiles` call and posts the raw text back. The backend never touches the platform.
- `addDocument` parses frontmatter once through `prepareSearchContent` (`projectRawNote`), so
  malformed YAML never throws during indexing.
- `SearchEngine` tracks indexed document ids. Vault indexing and store reset must clear or prune
  stale ids so documents from a previous vault or older serialized index cannot remain searchable.
- Persisted search indexes use a versioned `.cortex/cache/search-index.json` wrapper (version 2) with
  MiniSearch data plus per-document fingerprints in `FileEntry` units (`mtime` seconds, UTF-8 size).
  The engine stays in memory per vault: `indexVault` reads the file only on the first pass for a
  vault, later passes diff fingerprints against the live engine. Serialization is debounced (5 s)
  and produced by `backend.serialize()` as one `JSON.stringify` of the wrapper; the store writes it.
- Incremental updates go through `indexFile(vaultPath, path, snapshot?)` and `removeFile` (which
  also removes descendants of a deleted folder). `@cortex/core` drives them from watcher, file-list,
  and NoteCache events; do not trigger full `indexVault` passes on saves.
- The `tag:`/`path:`/`file:` query DSL lives in `query.ts` (`parseSearchQuery`, `toSearchRequest`)
  and the store's `runQuery(raw)`; UI surfaces must not reimplement it.
- Full-text search should cap default result sets for sidebar rendering. Title-only search for quick
  open surfaces should stay separately capped and lightweight.
- Snippet matching must not run one string lookup per query term. Build one escaped matcher for the
  query and scan the content once.
- When transforming and dropping empty query terms, use one-pass `flatMap` instead of
  `map(...).filter(Boolean)`.
- Use `Set` or `Map` only for repeated membership checks over collections. Do not use them for
  substring positions.

## Matches, Tokens, and Suggestions

- `buildSearchMatches(content, query)` returns the match count and up to three snippets with match
  ranges; `SearchResult` carries `matchCount` and `snippets`. Render ranges with `splitSnippet`.
- `tokenizeSearchQuery`, `removeSearchQueryToken`, and `getSearchSuggestions` are the shared query UI
  rules for every surface. Multiple `path:` filters map to `SearchOptions.folders`.
- `search`, `runQuery`, `setQuery`, `searchTitles`, and `findNotes` are async. `runQuery`/`search`
  set `query` synchronously and publish `results` only for the latest request (previous results stay
  visible until then). Callers of `searchTitles`/`findNotes` must drop stale responses themselves
  (latest query wins).
- `findNotes`, `loadMatches`, `findPhrase`, and `readNoteExcerpt` query without touching the sidebar
  `results`. `recentQueries` persists to `searchHistory` in `.cortex/local.json`; `noteHighlight` asks the
  editor host to highlight a query in one note.
- `extractWikiLinks(body)` and `countWords(body)` are the shared parsers for links and word counts.

- `extractWikiLinks` skips `@[[Name]]` mentions, so they never become backlinks or unresolved links.
