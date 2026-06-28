# AGENTS.md

## Package Purpose

`@cortex/templates` owns the platform-neutral template language used by desktop and future
React Native clients. Keep it free of React, DOM, Tauri, Node-only APIs, and filesystem access.

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
