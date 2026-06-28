# CLAUDE.md — @cortex/search

## Purpose

`@cortex/search` provides full-text search over vault notes using MiniSearch. Runs entirely in-memory in the frontend process.

## Architecture

- **`types.ts`** — `SearchDocument`, `SearchResult`, `SearchOptions` types
- **`preprocessor.ts`** — Strips Markdown syntax, extracts frontmatter tags/aliases for indexing
- **`searchEngine.ts`** — `SearchEngine` class wrapping MiniSearch with field boosting (title x3, aliases x2, tags x2, content x1), fuzzy search, prefix matching
- **`searchStore.ts`** — Zustand store managing indexing lifecycle, search queries, and index serialization

## Key Patterns

### Indexing
- `indexVault(vaultPath, files)` — Reads all `.md` files, extracts frontmatter, strips markdown, indexes into MiniSearch
- `indexFile(vaultPath, filePath)` — Re-indexes a single file (for watcher events)
- `removeFile(vaultPath, filePath)` — Removes a file from the index
- Index persisted to `vault/.cortex/search-index.json` with 5s debounce

### Search
- `search(query, options?)` — Full-text search with optional folder filter and limit
- `searchTitles(query)` — Title-only search (used by Quick Finder)
- Results include score, matched fields, and context snippets

### Document ID
Document IDs are relative paths from vault root (e.g. `notes/my-note.md`).

## Dependencies
- `@cortex/platform` — for file I/O
- `@cortex/core` — for centralized `parseFrontmatter()` utility (frontmatter extraction in preprocessor)
- `minisearch` — full-text search engine
- `zustand` — store
