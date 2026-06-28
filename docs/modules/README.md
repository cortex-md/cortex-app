# Module Map

This is a quick map of the Cortex modules that community authors should understand before building
plugins or themes.

| Module | Role | Community-facing contract |
| --- | --- | --- |
| `@cortex.md/api` | Public plugin API package. | Plugin authors import `CortexPlugin` and public types only from here. It stays free of React, DOM, CodeMirror, Tauri, Node, and Cortex internals. |
| `@cortex/plugin-host-core` | Portable plugin lifecycle and capability enforcement. | Registers commands, views, settings, markdown extensions, properties, data, bookmarks, and notifications behind manifest capabilities. |
| `@cortex/plugin-host-web` | Desktop/web plugin renderer and loader. | Loads vault-local plugin bundles from `.cortex/plugins`, renders declarative views, installs plugin markdown styles, and reloads enabled plugins. |
| `@cortex/renderer` | Sanitized Markdown rendering pipeline. | Runs plugin inline and semantic Markdown registrations across Markdown surfaces, and runs advanced processors only for reading/export. |
| `@cortex/editor` | Editable Markdown and CodeMirror integration. | Hosts active editor read/write bridges, fold providers, Live Preview, and editor-specific extensions. |
| `@cortex/theme` | Theme tokens, CSS variables, built-in themes, and community theme manifests. | Parses community theme manifests and exposes public CSS variables for app, editor, and Markdown surfaces. |
| `@cortex/marketplace` | Install, uninstall, update, staging, and rollback logic. | Installs plugin/theme release assets into vault-scoped `.cortex` directories and restores previous installs on failure. |
| `@cortex/platform` | Cross-platform filesystem, dialogs, windows, notifications, and app services. | Community APIs go through host bridges instead of exposing desktop-only platform details. |
| `@cortex/commands` | Shared command registry. | Plugin commands enter the same palette, hotkey, and Vim command surfaces as built-in commands. |
| `@cortex/properties` | Note property schemas, value parsing, and property type runtime. | Plugin property types are registered through the public plugin API and namespaced by plugin id. |

## Boundary Rules

- Plugin bundles must not import Cortex internal packages such as `@cortex/core`,
  `@cortex/editor`, `@cortex/platform`, or `@cortex/plugin-host-core`.
- Plugin UI is declarative and host-rendered. Do not expose React components, DOM nodes,
  `className`, or inline styles through the public plugin API.
- Community themes are browser CSS. Cortex parses only the theme manifest; stylesheet contents are
  otherwise treated as opaque CSS by the desktop app.
- Theme authors should use public CSS variables and stable hooks, not private component structure.

