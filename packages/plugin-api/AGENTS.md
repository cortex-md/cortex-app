# @cortex.md/api

## Public Contract

- This package is the zero-dependency public TypeScript contract imported by plugin authors. Do not
  add React, DOM, CodeMirror, Electron, Node, or runtime package imports here. The only runtime values
  are `definePlugin` (identity) and `PLUGIN_PERMISSIONS`.
- A plugin is one `export default definePlugin({ manifest, settings, contributes, activation,
  activate, load })` object. There is no plugin class and no imperative register wrappers.
- `contributes` is static data (commands, views, sidebar items, status bar items, context menu
  items, markdown rules, property types, fold providers, editor extensions). Hosts register it
  without running plugin code. Command `run`, view `render/reduce/onAction`, and `activate` run on
  first use; `load: () => import("./impl")` resolves missing handlers lazily (type the module with
  `satisfies PluginImplementation`). `activation: "startup"` activates at enable.
- `definePlugin` infers setting keys, command ids, and view ids into `PluginContext`; status bar and
  context menu items reference command ids, sidebar items reference view ids, and `when` accepts
  boolean setting keys only. Keep new contribution kinds typed the same way.
- Settings are one schema record with defaults (`settings: { key: { type, label, default } }`).
  The host renders the settings page and applies defaults in `ctx.settings.get`.
- `ViewDescriptor` is a discriminated union of declarative host-rendered nodes. Do not add free
  `className`, inline style, arbitrary DOM, component, or event-handler escape hatches. Views run
  effects through `onAction(ctx, action, payload, state)`.
- Plugin UI must stay portable across desktop and mobile hosts. Icons are string names.

## Permissions

- Contributions never need a permission: declaring them is the grant. Runtime host APIs on the
  context (vault, editor read/write, workspace tabs, theme, bookmarks, data, notifications) require
  `manifest.permissions`, defined once in `PLUGIN_PERMISSIONS`. Do not reintroduce a parallel
  capability union, validation array, or requirements map.
- Plugins do not get a standalone hotkeys API. `defaultHotkey` on a command is mirrored into
  hotkeys and Vim by the host.
- `ctx.bookmarks` exposes vault-relative Markdown paths only; `ctx.data` is plugin-scoped storage.
- Notifications use the `notifications` permission; plugins never request OS permission directly.

## Markdown

- `contributes.markdown.inline` and `.semantic` are the portable path for Live Preview, Reading
  View, and export. `preprocessors` and `processors` are limited to `reading-view` and `export`.
- Semantic output remains validated portable nodes only.
