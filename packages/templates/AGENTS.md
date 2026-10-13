# AGENTS.md

## Package Purpose

`@cortex/templates` owns the platform-neutral template language used by desktop and future
React Native clients. Keep it free of React, DOM, Electron, Node-only APIs, and filesystem access.

## Rules

- Export pure functions and serializable types only.
- Do not execute user JavaScript or add dynamic evaluation.
- Keep template rendering deterministic from the provided `TemplateRenderContext`.
- Manifest `bodyPath` values must normalize to safe relative paths under the templates directory.
  Reject absolute paths, drive-letter paths, and `..` traversal before any platform filesystem code
  joins paths.
- Render unknown placeholders as empty values so unfinished templates stay usable, while keeping
  explicit validation errors for unsupported filters and malformed expressions.
- Add focused parser/render tests for every language feature.
- `formatTemplateDate(date, pattern)` is the single date formatter for template filters and daily
  note file names; it supports `yyyy yy MM M dd d HH H mm m ss s ww w` only.
- `getTemplateValueGroups` is the single catalog for "Insert value" menus and the `{{` autocomplete
  (Dates / The new note / Vault with live examples); `getTemplateValueLabel` names chips.
- `getFileNameParts`/`createFileNamePattern` convert between chip lists and `fileNamePattern`;
  `getFileNameParts` returns `null` for patterns with literal text so the UI falls back to raw input.
- `createTemplateBodyFromNote` keeps only headings; `createNoteTemplateBundle` /
  `readNoteTemplateBundle` define the shared note template payload (`template.json` + `template.md`).
