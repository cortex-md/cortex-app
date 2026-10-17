# Markdown and Callouts

Markdown styling is shared by Live Preview, Reading View, and rendered plugin Markdown nodes. Theme
changes should keep those surfaces visually aligned.

## Layout Variables

```css
body.theme-warm-notes-light {
	--markdown-content-width: 760px;
	--markdown-content-gutter: 40px;
	--markdown-block-radius: 8px;
	--markdown-block-spacing: 1em;
}
```

Avoid adding vertical padding, margins, transforms, or non-baseline alignment to editable
CodeMirror line content. Prefer variables and non-disruptive visual chrome.

## Code

```css
body.theme-warm-notes-light {
	--markdown-code-font-family: Menlo, Monaco, Consolas, "Liberation Mono", monospace;
	--markdown-code-font-size: 14px;
	--markdown-code-padding-inline: 16px;
	--markdown-code-padding-block: 8px;
	--bg-code: #f2efe8;
}
```

Fenced code blocks use `--markdown-code-font-family`. Inline code spans use `--font-mono` at 0.86em
with no box, colored by `--markdown-inline-code-color`. Wiki and external links sit on a
highlighter stroke colored by `--markdown-link-mark-color`, and `==highlights==` use
`--markdown-highlight-color`. Inline `#tags` render as `.markdown-tag` (Reading View) and `.cm-tag`
(Live Preview).

## Headings

```css
body.theme-warm-notes-light {
	--heading-font-weight: 650;
	--h1-font-size: 1.4em;
	--h2-font-size: 1.22em;
	--h3-font-size: 1.08em;
	--h1-color: var(--text-primary);
	--h2-color: var(--text-primary);
}
```

Built-in themes keep headings in `--text-primary`; H2 and H3 get small margin marks (an accent bar
and a muted dot) drawn by the editor CSS.

## Callouts

Standard callout variables use this pattern:

```css
body.theme-warm-notes-light {
	--callout-note-color: var(--accent);
	--callout-note-bg: var(--accent-subtle);
	--callout-warning-color: var(--status-warning);
	--callout-warning-bg: var(--warning-bg);
}
```

Common built-in callout names include `note`, `abstract`, `info`, `todo`, `tip`, `success`,
`question`, `warning`, `failure`, `danger`, `bug`, `example`, and `quote`.

Each built-in type has an icon drawn in `--callout-color`; the callout background is
`--callout-<type>-bg` with a hairline mixed from the callout color.

Plugins can register or override callout types. Explicit plugin colors take precedence over theme
defaults for those registered callouts.

