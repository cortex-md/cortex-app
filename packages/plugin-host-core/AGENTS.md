# @cortex/plugin-host-core

## Portable Plugin Host

- This package owns the framework-free plugin host state, lifecycle, public API factories,
  capability guards, plugin data access, command/hotkey/editor/workspace bridges, markdown
  registration bridge, and plugin-owned registration bookkeeping.
- Do not import React, React DOM, `@cortex/ui`, CodeMirror runtime values, Tauri, browser DOM APIs,
  or Node-only modules here. `check:boundaries` must enforce this as a portable package.
- Expose `pluginStore` as a vanilla Zustand store. React hooks belong in `@cortex/plugin-host-web`
  or a future native host package.
- Public plugin APIs must be guarded through `requirePluginCapability(...)` or
  `pluginHasCapability(...)` before touching host state. Keep new API methods capability-gated at
  the host boundary.
- Bookmark APIs validate portable vault-relative Markdown paths in the host before forwarding to a
  platform bridge. Do not expose absolute paths, host filesystem separators, or stale `string[]`
  bookmark lists to plugins, and do not reintroduce reorder handling without a public API update.
- `api.commands.register(...)` is the only plugin path for actions, hotkeys, and Vim command-line
  names. Do not add `api.hotkeys`; command `defaultHotkey` is mirrored by the desktop hotkey bridge
  through `@cortex/commands`.
- `api.editor.registerFoldProvider(...)` stores portable line-based providers only. Keep CodeMirror
  conversion in `@cortex/editor`, preserve provider registration order/priority in snapshots, and
  require the `editor:folding` capability at registration time.
- Plugin command ids are local to the plugin in the public API and prefixed internally before they
  enter `CommandRegistry`. Disposing or unloading a plugin must unregister its commands so palette,
  hotkeys, and Vim choices disappear together.
- `api.data` is guarded by the single `data` capability. Keep data storage scoped to the plugin id
  and avoid exposing behavior that depends on desktop-only path semantics.
- Store plugin-contributed views, sidebar items, status bar items, settings tabs, context menu
  items, and modal instances with `pluginId` plus `registrationKey`. Public registration ids are
  local to the owning plugin and must not be treated as global host ids.
- Declarative modal state is host-owned. `api.ui.openModal(...)` may only open registered
  `location: "modal"` views; rendering chrome belongs to platform-specific host packages.
- Markdown style scoping is pure and lives here. Installing styles into a DOM or native style system
  must go through `setPluginMarkdownStyleHost(...)` from a platform host package.
- Markdown style scoping must not trust textual prefix checks. Existing `.markdown-surface` roots
  may be preserved only when the selector still targets the root or its descendants; sibling
  combinators that escape the surface must be rejected.
- `PluginLifecycle.ts` owns registration and enable/disable lifecycle for already-loaded plugin
  modules. It must not discover plugin files or evaluate plugin bundles.
- Invalid `.cortex/plugins.json` contents fail closed. Missing files may default-enable known
  bundled/community modules, but malformed JSON must not enable every plugin.
- Community plugin discovery is not the same as enablement. Use
  `getEnabledCommunityPluginEntries()` when a platform host needs to reload only plugins that are
  currently running.
- Community plugin filesystem discovery, CJS `eval`, ESM `data:` imports, DOM style insertion, and
  React renderers are web/desktop concerns and must stay out of this package.
- `registerRibbonAction` is intentionally absent until a host ribbon surface exists.
- `api.markdown.registerPreprocessor(...)` and Unified processors are renderer/export only. Live
  Preview-specific behavior belongs in semantic registrations or editor extensions.
