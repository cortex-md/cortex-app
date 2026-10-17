# @cortex/import-export

## Purpose

`@cortex/import-export` owns platform-neutral document transfer workflows for notes. It exposes
format registries, built-in CSV/HTML/PDF importers and exporters, and bounded batch helpers that
desktop and mobile can compose through `@cortex/platform`.

## Boundaries

- Keep this package free of React, DOM, Electron, Node filesystem APIs, and app stores.
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
- Path helpers come from `@cortex/platform/utils`; `src/path.ts` only keeps transfer-specific
  `sanitizeFileStem` and `reserveUniquePath`.

## Obsidian Import

- `src/obsidian/` owns the Obsidian migration. `readObsidianConfig`/`isObsidianVault` read the known
  `.obsidian/*.json` files in one `fs.readTextFiles` call and never write to `.obsidian`.
- `importObsidianVault` copies a vault into a destination folder of the current vault: it scans the
  source (hidden folders such as `.obsidian` and `.trash` are skipped), reserves every target path
  case-insensitively against a fresh scan of the destination (`Name 2.ext` on conflicts, never an
  overwrite), reads notes in batches of 200 through `readTextFiles`, and writes with a bounded pool.
  Unchanged notes and all attachments go through `fs.copyFile` (exclusive copy) with a binary
  read/write fallback; converted notes use `fs.writeFile` on the freshly reserved path, because an
  atomic write per file (fsync) made 11k files take ~28 s instead of ~2.5 s. Progress is reported per batch and an `AbortSignal` stops between batches,
  keeping what was already copied.
- `analyzeObsidianVault` is the open-in-place path: it reads the vault's notes only to count
  findings and map settings; it never rewrites notes.
- `convertObsidianMarkdown` converts only what Cortex cannot render and the conversion keeps
  lossless: image embeds `![[image.png|300]]` become note-relative Markdown images
  (`![image.png|300](../Attachments/image%20name.png)`, which Obsidian also reads), resolved like
  Obsidian (exact path, path suffix, same folder, then shortest path) against the planned target
  paths. Frontmatter, fenced code, and inline code are left alone. Everything else is counted as an
  `ObsidianFinding` (note/file embeds, comments, block ids, highlights, Dataview, Templater, canvas,
  Excalidraw, community plugins, unmapped bookmarks, property types, and date formats) for the
  summary instead of being dropped.
- `mapObsidianSettings` maps `.obsidian` into the neutral `VaultSettingsImport` shape that
  `@cortex/core` `applyVaultSettingsImport` applies: attachment folder (`app.json`), daily notes
  folder/format/template (`daily-notes.json`, Moment formats converted to template date patterns),
  templates (`templates.json` folder; `{{title}}`, `{{date}}`, `{{time}}` placeholders converted),
  note bookmarks (`bookmarks.json`, groups flattened), and `text`/`number`/`checkbox`/`date`
  property types (`types.json`). This package cannot depend on core, settings, or properties.
