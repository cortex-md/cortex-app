# CLAUDE.md — @cortex/renderer

Pure TypeScript markdown-to-HTML rendering package. No React, no platform dependencies.

## Purpose

Converts Markdown strings to HTML strings using the unified/remark/rehype pipeline.
Used by `@cortex/editor` for `ReadingView` and `SideBySideView`.

## Public API

```typescript
import { createRenderer } from "@cortex/renderer"

const renderer = createRenderer()
const html = await renderer.render(markdownString)
```

`createRenderer(options?)` builds a unified pipeline. `getSharedRenderer()` caches one processor
per reactive Markdown registry version. The returned
`Renderer` object is reusable — call `render()` repeatedly.

## Pipeline Order

1. `remark-parse` — Markdown → mdast
2. `remarkFrontmatter` — parses YAML structurally and saves fields to `file.data`
3. `remark-gfm` — GFM tables, strikethrough, task lists syntax
4. Surface-targeted remark processors on cloned trees
5. Native frontmatter extraction
6. `remark-rehype` — mdast → hast
7. Surface-targeted rehype processors on cloned trees
8. Shared inline and semantic portable-node transforms
9. Shared Markdown URL policy, including image-only `data:` URLs
10. `rehype-sanitize` — protocol, tag, and attribute allowlists
11. Trusted native frontmatter, callout, wiki link, and task-list transforms
12. `rehype-highlight` — syntax highlighting via highlight.js
13. `rehype-stringify` — hast → HTML string

## Plugins

| File | Stage | Purpose |
|------|-------|---------|
| `src/plugins/frontmatter.ts` (remarkFrontmatter) | remark | Strips YAML front matter nodes, parses fields into `file.data.frontmatterFields` |
| `src/plugins/frontmatter.ts` (rehypeFrontmatter) | rehype | Injects a styled Properties card (div.frontmatter-card) from parsed frontmatter data |
| `src/plugins/wikiLinks.ts` | rehype | Transforms `[[link]]` text into `<a data-wiki-link>` elements |
| `src/plugins/taskList.ts` | rehype | Enhances GFM task list items with `data-task-item` and checkbox inputs |

Plugins register shared Markdown behavior through `api.markdown`. Inline and semantic registrations
compose over portable text nodes and are applied to Live Preview, Reading View, and export.
Processor registrations declare a single phase plus `reading-view` and/or `export` targets; failures
are isolated and repeated slow/failing processors are disabled for the session.

## CSS Classes

The renderer produces `hljs-*` classes on code blocks. Map these to `--syntax-*`
CSS variables in `packages/editor/src/markdown.css`.

Wiki links use `data-wiki-link` attribute — style with `.reading-view a[data-wiki-link]`.
Task list items use `data-task-item="checked|unchecked"`.

Frontmatter Properties card uses these classes (style under `.reading-view`):
- `.frontmatter-card` — outer container (border, background, border-radius)
- `.frontmatter-header` — "Properties" label (uppercase, muted)
- `.frontmatter-fields` — field rows container (flex column)
- `.frontmatter-row` — single key-value row (flex row)
- `.frontmatter-key` — field name (muted text, fixed width)
- `.frontmatter-value` — field value
- `.frontmatter-tag` — tag chip (accent-colored pill)

## Key Constraints

- No React, no DOM APIs — pure string in, string out
- Pipeline is created once per `createRenderer()` call and reused
- `allowDangerousHtml: false` in remark-rehype — raw HTML in Markdown is stripped
- Public processor output must pass through `rehype-sanitize`
- URL handling must use `sanitizeMarkdownUrl`
