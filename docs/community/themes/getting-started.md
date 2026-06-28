# Getting Started With Themes

This guide creates a minimal light/dark community theme.

## Folder

```text
warm-notes/
  manifest.json
  light.css
  dark.css
```

Place or symlink it into the active vault:

```text
<vault>/.cortex/themes/warm-notes/
```

## Manifest

```json
{
	"id": "warm-notes",
	"name": "warm-notes",
	"displayName": "Warm Notes",
	"author": "Your Name",
	"version": "0.1.0",
	"minAppVersion": "0.1.0",
	"colorschemes": {
		"light": "light.css",
		"dark": "dark.css"
	}
}
```

`name` becomes the theme family name. Cortex registers two runtime theme names:

- `warm-notes-light`
- `warm-notes-dark`

## Light CSS

```css
body.theme-warm-notes-light {
	color-scheme: light;
	--bg-primary: #fbfaf6;
	--bg-secondary: #f2efe8;
	--bg-elevated: #ffffff;
	--text-primary: #2a2621;
	--text-muted: #756d62;
	--accent: #b84f35;
	--accent-hover: #a6462f;
	--accent-subtle: #f5ded6;
	--border: #ded7ca;
	--modal-bg: #ffffff;
	--menu-bg: #ffffff;
	--markdown-content-width: 760px;
}
```

## Dark CSS

```css
body.theme-warm-notes-dark {
	color-scheme: dark;
	--bg-primary: #201f1d;
	--bg-secondary: #2a2825;
	--bg-elevated: #302e2a;
	--text-primary: #f2ece2;
	--text-muted: #aaa197;
	--accent: #e0795d;
	--accent-hover: #ee8a6e;
	--accent-subtle: #4a2b25;
	--border: #403b35;
	--modal-bg: #2a2825;
	--menu-bg: #2a2825;
	--markdown-content-width: 760px;
}
```

## Reload

Cortex watches `<vault>/.cortex/themes`. Editing a theme file triggers a reload. If the active theme
is the edited family, Cortex reapplies the current appearance settings after reload.

