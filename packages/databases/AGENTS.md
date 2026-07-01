# @cortex/databases

- Own portable database catalogs, database views, row indexing, and query evaluation.
- Keep the package framework-free and platform-agnostic. Platform and cache access is injected
  through `initializeDatabases`.
- Rows are Markdown notes. Values are read from YAML frontmatter through `@cortex/properties`; do
  not add a second property parser or store database cell values outside notes.
- Database membership is stored on notes through the reserved frontmatter key
  `cortex-databases`. Queries should use membership as the primary row source; legacy catalog
  `source` values may be normalized into defaults but must not drive V2 row inclusion.
- Inline database embeds are represented by the one-line marker
  `{{database:<databaseId>#<viewId>}}`. Keep parsing and serialization in this pure package, while
  React rendering stays host-owned.
- Persist user-authored definitions in `.cortex/schema/databases.json` and derived row caches in
  `.cortex/database-index.json`. Definitions are syncable; caches are local and rebuildable.
- Use vault-relative paths inside persisted catalog/cache files. Runtime query results may expose
  absolute note paths for app stores and workspace tabs.
- Indexing must stay bounded. Reuse host-provided vault file lists, compare file fingerprints before
  reading notes, and read changed notes with a small worker pool.
- Do not import React, DOM, Tauri, CodeMirror, `@cortex/ui`, Node filesystem modules, or desktop app
  code from production sources.
