# Theme Manifest

Every community theme needs a root `manifest.json`.

## Shape

```json
{
	"id": "warm-notes",
	"name": "warm-notes",
	"displayName": "Warm Notes",
	"author": "Your Name",
	"authorUrl": "https://example.com",
	"version": "0.1.0",
	"minAppVersion": "0.1.0",
	"colorschemes": {
		"light": "light.css",
		"dark": "dark.css"
	}
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Theme install id. Marketplace releases must match this id. |
| `name` | Yes | Theme family slug. Must match `^[a-z0-9][a-z0-9-]*$`. |
| `displayName` | Yes | User-facing family name. |
| `author` | Yes | Displayed in theme and Marketplace UI. |
| `authorUrl` | No | Valid URL for the author or organization. |
| `version` | Yes | Use semver for update comparisons. |
| `minAppVersion` | No | Minimum Cortex version expected by the theme. |
| `colorschemes.light` | Yes | Safe relative path to the light CSS file. |
| `colorschemes.dark` | Yes | Safe relative path to the dark CSS file. |

## Safe Stylesheet Paths

Stylesheet paths must be relative to the theme folder. Cortex rejects:

- Empty paths.
- Absolute paths.
- Windows drive-letter paths.
- Paths containing `..`.

Good:

```json
{ "light": "light.css", "dark": "schemes/dark.css" }
```

Bad:

```json
{ "light": "../light.css", "dark": "/tmp/dark.css" }
```

## Runtime Theme Names

For a manifest with `"name": "warm-notes"`, Cortex registers:

- `warm-notes-light`
- `warm-notes-dark`

The active runtime theme is applied to the body as:

```html
<body class="theme-warm-notes-light" data-theme-scheme="light">
```

Write CSS selectors against those runtime body classes.

