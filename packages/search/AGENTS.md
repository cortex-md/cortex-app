# @cortex/search

## Performance

- Vault indexing may read Markdown files concurrently, but keep reads bounded on large vaults. Apply
  documents to MiniSearch sequentially after content collection.
- Implement bounded indexing with a `Promise.all` worker pool rather than `await` inside loops, so
  independent reads stay parallel while writes into MiniSearch remain ordered.
- Keep full stripped Markdown content indexable for search correctness, but do not store full note
  bodies in MiniSearch `storeFields` or serialized indexes. Store only bounded preview text for
  snippets.
- `SearchEngine` tracks indexed document ids. Vault indexing and store reset must clear or prune
  stale ids so documents from a previous vault or older serialized index cannot remain searchable.
- Persisted search indexes use a versioned `.cortex/search-index.json` wrapper with MiniSearch data
  plus per-document fingerprints. Warm vault indexing should reuse unchanged documents from that
  wrapper and read only changed Markdown files before pruning stale ids.
- Full-text search should cap default result sets for sidebar rendering. Title-only search for quick
  open surfaces should stay separately capped and lightweight.
- Snippet matching must not run one string lookup per query term. Build one escaped matcher for the
  query and scan the content once.
- When transforming and dropping empty query terms, use one-pass `flatMap` instead of
  `map(...).filter(Boolean)`.
- Use `Set` or `Map` only for repeated membership checks over collections. Do not use them for
  substring positions.
