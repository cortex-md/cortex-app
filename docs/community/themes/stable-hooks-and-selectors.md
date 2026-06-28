# Stable Hooks and Selectors

Prefer CSS variables first. When variables are not enough, use stable hooks that Cortex exposes for
themes and surfaces.

## Theme Root

Scope each variant to its runtime body class:

```css
body.theme-warm-notes-light {
	color-scheme: light;
	--bg-primary: #fbfaf6;
}

body.theme-warm-notes-dark {
	color-scheme: dark;
	--bg-primary: #201f1d;
}
```

Use `body[data-theme-scheme="dark"]` and `body[data-theme-scheme="light"]` when a rule should
follow the effective color scheme instead of a specific theme family.

## Markdown

Use `.markdown-surface` for rendered Markdown and editor-projected Markdown styling:

```css
body.theme-warm-notes-light .markdown-surface blockquote {
	border-left-color: var(--accent);
}
```

Plugin `styles.css` files are also scoped to `.markdown-surface`, but community themes can style
the broader app.

## Overlays and Popups

Stable overlay hooks include:

- `[data-popup-surface]`
- `[data-command-surface]`
- `[data-slot="dialog-content"]`
- `[data-slot="alert-dialog-content"]`
- `[data-slot="dropdown-menu-content"]`
- `[data-slot="context-menu-content"]`
- `[data-slot="select-content"]`
- `[data-slot="popover-content"]`
- `[data-slot="hover-card-content"]`

Example:

```css
body.theme-warm-notes-light [data-popup-surface] {
	box-shadow: 0 0 0 1px color-mix(in srgb, var(--border) 70%, transparent),
		0 18px 48px color-mix(in srgb, black 12%, transparent);
}
```

## App Shell

Use shell selectors sparingly:

- `.app-shell`
- `.app-titlebar`
- `.app-content`
- `.app-sidebar`
- `.app-main`
- `.tab-bar`
- `.tab-trigger`
- `.statusbar-item`
- `.file-tree-item`

These are stronger than tokens and should be reserved for theme-specific polish that variables
cannot express.

## Avoid

- Private generated class names.
- Selectors that depend on deep child order.
- Global resets such as `* { ... }`.
- `!important` unless overriding explicit user appearance settings is truly intended.
- Built-in theme selectors such as `.theme-ink` for community theme behavior.

