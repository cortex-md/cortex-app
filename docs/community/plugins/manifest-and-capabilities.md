# Manifest and Capabilities

Every community plugin needs a `manifest.json` at the plugin root.

## Manifest Shape

```json
{
	"id": "example-plugin",
	"name": "Example Plugin",
	"version": "0.1.0",
	"minAppVersion": "0.1.0",
	"author": "Your Name",
	"authorUrl": "https://example.com",
	"description": "Adds a sample command and sidebar view.",
	"icon": "puzzle",
	"main": "dist/index.js",
	"capabilities": ["commands", "ui:views", "ui:sidebar"]
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Stable id unique inside a vault. Marketplace releases must match this id. |
| `name` | Yes | User-facing name. |
| `version` | Yes | Use semver for update comparisons. |
| `minAppVersion` | Yes | Minimum Cortex version the plugin expects. |
| `author` | Yes | Displayed in plugin and Marketplace surfaces. |
| `authorUrl` | No | Public URL for the author or organization. |
| `description` | Yes | Short install/review summary. |
| `icon` | Yes | Lucide icon name or host-supported icon identifier. |
| `main` | Yes | Safe relative path to the plugin bundle. |
| `capabilities` | No | Required before guarded API calls work. |

## Capability Reference

| Capability | Enables |
| --- | --- |
| `commands` | `api.commands.register`, `api.commands.execute`, command palette, hotkeys, Vim names. |
| `settings` | Plugin settings storage, schemas, settings tabs, and `onChange` listeners. |
| `vault:read` | Vault path, file reads, file listings, `exists`, metadata reads, and tag reads. |
| `vault:write` | Writing text files in the active vault. |
| `vault:delete` | Deleting files from the active vault. |
| `vault:watch` | Subscribing to vault file events. |
| `editor:read` | Active file path and active editor content reads. |
| `editor:write` | Cursor insertion and selection replacement. |
| `editor:extensions` | Host-specific editor extensions. |
| `editor:folding` | Portable line-based fold providers. |
| `markdown:extensions` | Inline, semantic, callout, preprocessor, processor, and plugin `styles.css` support. |
| `properties:types` | Custom note property type registration. |
| `ui:views` | Declarative host-rendered views. |
| `ui:sidebar` | Sidebar items that open registered views. |
| `ui:statusbar` | Status bar items. |
| `ui:contextmenu` | File, editor, and tab context menu items. |
| `ui:modals` | Opening and closing registered modal views. |
| `workspace:tabs` | Opening files, views, and temporary Markdown tabs. |
| `theme:read` | Active theme name and theme change subscriptions. |
| `bookmarks:read` | Bookmark list, lookup, and change subscriptions. |
| `bookmarks:write` | Add, remove, and toggle bookmarks. |
| `data` | Plugin-owned data files. |
| `notifications` | Native notifications and lightweight notices. |

## Best Practices

- Request the narrowest capabilities you need.
- Treat capabilities as user-visible permissions.
- Do not call APIs defensively and ignore capability failures. Declare the capability or remove the
  feature.
- Use local ids for plugin commands, views, settings, and context menu items. Cortex prefixes where
  global uniqueness is needed.

