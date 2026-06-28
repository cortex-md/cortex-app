# Theme Best Practices

Good community themes feel native to Cortex while still having a clear voice.

## Use Tokens First

Prefer semantic variables such as `--bg-primary`, `--text-primary`, `--accent`,
`--modal-bg`, and `--markdown-content-width` before writing component selectors.

Tokens survive UI refactors better than deep selectors.

## Keep Contrast Strong

- Body text should meet at least 4.5:1 contrast.
- Focus indicators should meet at least 3:1 contrast against adjacent surfaces.
- Test disabled, muted, warning, error, and selected states.
- Do not rely on color alone for important state.

## Respect User Overrides

Users may override font family, UI font size, editor font size, and accent preferences. Avoid
heavy-handed `!important` rules that fight explicit user choices.

## Keep CSS Cheap

- Avoid expensive global selectors.
- Avoid broad `backdrop-filter` rules.
- Avoid large data URLs and embedded images.
- Avoid animating layout properties.
- Prefer `opacity`, `transform`, and token changes for subtle motion.

## Scope Carefully

Good:

```css
body.theme-warm-notes-light [data-popup-surface] {
	border-radius: 12px;
}
```

Risky:

```css
div > div > div:nth-child(2) {
	border-radius: 12px;
}
```

## Test Checklist

- Main editor in source, Live Preview, Reading View, and Side-by-Side.
- Command palette, quick switcher, dropdowns, popovers, context menus, and modals.
- Settings window/modal fallback.
- File explorer, tabs, status bar, bookmarks, tags, and properties.
- Markdown headings, tables, code blocks, links, callouts, task lists, and blockquotes.
- Light, dark, and system appearance modes.

