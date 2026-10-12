# Manifest and Permissions

The manifest lives inside `definePlugin({ manifest })`. The vault `manifest.json` only needs `id`
and `main` so the loader can find the bundle.

## Manifest Shape

```ts
manifest: {
	id: "example-plugin",
	name: "Example Plugin",
	version: "0.1.0",
	minAppVersion: "0.1.0",
	author: "Your Name",
	authorUrl: "https://example.com",
	description: "Adds a sample command and sidebar view.",
	icon: "puzzle",
	permissions: ["vault:read", "workspace:tabs"],
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Stable id unique inside a vault. Must match `manifest.json` and the Marketplace entry. |
| `name` | Yes | User-facing name; also labels the plugin settings page. |
| `version` | Yes | Semver for update comparisons. |
| `minAppVersion` | Yes | Minimum Cortex version the plugin expects. |
| `author` | Yes | Displayed in plugin and Marketplace surfaces. |
| `authorUrl` | No | Public URL for the author or organization. |
| `description` | Yes | Short install/review summary. |
| `icon` | Yes | Lucide icon name. |
| `main` | No | Filled from `manifest.json` for community bundles. |
| `permissions` | No | Runtime context APIs the plugin calls. Unknown values fail the load. |

## Contributions Need No Permission

Commands, views, sidebar items, status bar items, context menu items, settings, Markdown rules,
property types, fold providers, and editor extensions are granted by declaring them under
`contributes`. The plugin's capabilities are derived from that declaration.

## Runtime Permissions

`PLUGIN_PERMISSIONS` lists every value. A context call without its permission throws (or, for
notifications, returns `{ delivered: false, reason: "missing-capability" }`).

| Permission | Enables |
| --- | --- |
| `vault:read` | `ctx.vault` reads, listings, `exists`, `getVaultPath`, and `ctx.metadata`. |
| `vault:write` | `ctx.vault.writeFile`. |
| `vault:delete` | `ctx.vault.deleteFile`. |
| `vault:watch` | `ctx.vault.onFileEvent`. |
| `editor:read` | Active file path and content. |
| `editor:write` | `insertAtCursor` and `replaceSelection`. |
| `workspace:tabs` | Opening files, plugin views, and temporary Markdown tabs; open-file reads. |
| `theme:read` | Active theme name and theme change subscriptions. |
| `bookmarks:read` | Bookmark list, lookup, and change subscriptions. |
| `bookmarks:write` | Add, remove, and toggle bookmarks. |
| `data` | Plugin-owned data files. |
| `notifications` | Native notifications and `ctx.ui.showNotice`. |

Request the narrowest set you need; permissions are user-visible.
