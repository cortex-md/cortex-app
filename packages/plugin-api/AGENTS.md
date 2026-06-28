# @cortex.md/api

## Public Contract

- This package is the zero-dependency public TypeScript contract imported by plugin authors. Do not
  add React, DOM, CodeMirror, Tauri, Node, or runtime package imports here.
- `ViewDescriptor` is a discriminated union of declarative host-rendered nodes. Do not add free
  `className`, inline style, arbitrary DOM, component, or event-handler escape hatches.
- Plugin UI must stay portable across desktop and future mobile hosts. Icons are string names, not
  imported components.
- Utility UI nodes such as `setting-row`, `item`, `alert`, `tabs`, `table`, and input variants are
  portable descriptors. Add future UI by extending this union, not by exposing React or DOM handles.
- `api.ui.openModal(...)` opens a registered `location: "modal"` declarative view and returns a
  host-owned modal instance id. Plugins close modals through `api.ui.closeModal(...)`.
- `CortexPlugin.registerSettingsTab(...)` returns one idempotent disposable that removes both the
  tab and any setting `onChange` listeners registered from the tab definitions.
- `registerRibbonAction` is intentionally absent until a host ribbon surface exists.

## Capabilities

- Every public sub-API method must have an explicit manifest capability enforced by
  `@cortex/plugin-host-core`.
- Keep capability names granular and stable: vault read/write/delete/watch, editor read/write and
  extensions/folding, markdown extensions, UI surfaces, workspace tabs, theme read, bookmarks,
  commands, settings, plugin data, properties, and notifications.
- `editor:folding` exposes only portable line-based fold providers. Do not expose CodeMirror,
  editor DOM, syntax tree nodes, or host-specific fold state through the public API.
- Plugins do not get a standalone hotkeys API. A plugin declares a configurable shortcut through
  `PluginCommand.defaultHotkey`, and the host mirrors that command into hotkeys and Vim.
- `api.data` requires the single `data` capability. The host owns storage location details and may
  map them differently across desktop and future mobile hosts.
- `api.bookmarks` exposes ordered `BookmarkEntry` objects with vault-relative Markdown paths only.
  Keep this contract free of host path details; plugins must not pass absolute paths or paths outside
  the active vault. It intentionally does not expose bookmark reordering.
- Notifications use the `notifications` capability; plugins never request OS notification
  permission directly.

## Markdown

- `registerInline(...)` and `registerSemantic(...)` are the portable path for Live Preview,
  Reading View, and export.
- `registerPreprocessor(...)` and `registerProcessor(...)` are limited to `reading-view` and
  `export`. Do not expose Live Preview through Unified preprocessors/processors.
- Semantic output remains validated portable nodes only. Do not add arbitrary DOM, HAST, CodeMirror
  widgets, inline styles, or event handlers to the public contract.
