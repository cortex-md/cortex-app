# @cortex/search

## Performance

- Vault indexing may read Markdown files concurrently, but keep reads bounded on large vaults. Apply
  documents to MiniSearch sequentially after content collection.
- Implement bounded indexing with a `Promise.all` worker pool rather than `await` inside loops, so
  independent reads stay parallel while writes into MiniSearch remain ordered.
- Keep full stripped Markdown content indexable for search correctness, but never store note bodies
  or previews in MiniSearch `storeFields` or serialized indexes. Snippets are computed on demand
  after `search` from note content read through the platform (bounded concurrency, small LRU cache
  invalidated by `indexFile`/`removeFile`).
- `addDocument` parses frontmatter once through `prepareSearchContent` (`projectRawNote`), so
  malformed YAML never throws during indexing.
- `SearchEngine` tracks indexed document ids. Vault indexing and store reset must clear or prune
  stale ids so documents from a previous vault or older serialized index cannot remain searchable.
- Persisted search indexes use a versioned `.cortex/search-index.json` wrapper (version 2) with
  MiniSearch data plus per-document fingerprints in `FileEntry` units (`mtime` seconds, UTF-8 size).
  The engine stays in memory per vault: `indexVault` reads the file only on the first pass for a
  vault, later passes diff fingerprints against the live engine. Serialization is debounced and
  uses one `JSON.stringify` of the wrapper (the engine serializes through `toJSON`).
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
- `findNotes`, `loadMatches`, `findPhrase`, and `readNoteExcerpt` query without touching the sidebar
  `results`. `recentQueries` persists to `.cortex/search-history.json`; `noteHighlight` asks the
  editor host to highlight a query in one note.
- `extractWikiLinks(body)` and `countWords(body)` are the shared parsers for links and word counts.

- `extractWikiLinks` skips `@[[Name]]` mentions, so they never become backlinks or unresolved links.
