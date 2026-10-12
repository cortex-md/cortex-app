# CLAUDE.md — @cortex/search

## Purpose

`@cortex/search` provides full-text search over vault notes using MiniSearch. The engine runs behind
the async `SearchBackend` contract: in-process by default (tests, mobile) or inside a desktop Web
Worker. See `AGENTS.md` for the performance and contract rules.

## Architecture

- **`types.ts`** — `SearchDocument`, `SearchResult`, `SearchOptions` types
- **`preprocessor.ts`** — Strips Markdown syntax, extracts frontmatter tags/aliases for indexing
- **`searchEngine.ts`** — `SearchEngine` class wrapping MiniSearch with field boosting (title x3, aliases x2, tags x2, content x1), fuzzy search, prefix matching
- **`backend.ts`** — `SearchBackend` async contract and `createLocalSearchBackend()` (engine, fingerprints, persisted index parse/serialize); exported as `@cortex/search/backend` for worker entries
- **`query.ts`** — `tag:`/`path:`/`file:` query DSL shared by search surfaces
- **`searchStore.ts`** — Zustand store managing indexing lifecycle (IO, batching, generations), async search queries, on-demand snippets, and index file writes; `setSearchBackend` swaps the backend

## Key Patterns

### Indexing
- `indexVault(vaultPath, files)` — Loads the persisted index into the backend, asks `planIndex` for stale notes, reads them with `fs.readTextFiles` in batches and posts them to the backend
- `indexFile(vaultPath, filePath, snapshot?)` — Re-indexes a single file (driven by `@cortex/core` runtime events)
- `removeFile(vaultPath, filePath)` — Removes a file from the index
- Index persisted to `vault/.cortex/search-index.json` with 5s debounce

### Search
- `search(query, options?)` — Async full-text search with optional folder filter and limit; latest request wins
- `searchTitles(query)` — Async title-only search (used by Quick Finder, which drops stale responses)
- Results include score, matched fields, and context snippets

### Document ID
Document IDs are relative paths from vault root (e.g. `notes/my-note.md`).

## Dependencies
- `@cortex/platform` — for file I/O
- `@cortex/properties` — frontmatter projection (`projectRawNote`, `extractFrontmatterBody`)
- `minisearch` — full-text search engine
- `zustand` — store
