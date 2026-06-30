# @cortex/import-export

## Purpose

`@cortex/import-export` owns platform-neutral document transfer workflows for notes. It exposes
format registries, built-in CSV/HTML/PDF importers and exporters, and bounded batch helpers that
desktop and mobile can compose through `@cortex/platform`.

## Boundaries

- Keep this package free of React, DOM, Tauri, Node filesystem APIs, and app stores.
- Use `@cortex/platform` contracts for reads, writes, dialogs, PDF bridges, and future native
  adapters.
- PDF export should save to a user-selected `.pdf` path through the native document export bridge.
  Do not open print windows from this package.
- PDF import must extract text through `documentImport.extractPdfText(...)` and produce Markdown
  content. Do not silently create a link-only note for PDFs that cannot be extracted.
- Use `@cortex/renderer` for Markdown-to-HTML export so plugin Markdown extensions continue to
  target the renderer's `"export"` surface.
- Add new import sources, such as Notion, by registering an importer instead of branching desktop UI
  flows.
- Batch import/export should reserve output paths before parallel work starts, then run with a
  bounded worker pool and per-file result reporting.
