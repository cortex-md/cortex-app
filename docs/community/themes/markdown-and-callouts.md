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

Markdown code spans and fenced code blocks use editor typography by default. Smaller typography
belongs on code block chrome, not necessarily the code itself.

## Headings

```css
body.theme-warm-notes-light {
	--heading-font-weight: 650;
	--h1-font-size: 1.45em;
	--h2-font-size: 1.25em;
	--h3-font-size: 1.08em;
	--h1-color: var(--syntax-heading);
	--h2-color: var(--syntax-heading);
}
```

Keep heading scale compact enough that editing remains calm and dense.

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

Plugins can register or override callout types. Explicit plugin colors take precedence over theme
defaults for those registered callouts.

