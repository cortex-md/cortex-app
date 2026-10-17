# @cortex/renderer

## Performance

- The root `@cortex/renderer` barrel is the light API (registries, callouts, URL policy, types).
  The unified pipeline lives only behind `@cortex/renderer/pipeline` and must be loaded with a
  dynamic `import()` from app code so it stays out of the main chunk. Callout metadata is also
  available from `@cortex/renderer/callouts`.
- Registry getters return priority-sorted arrays cached per registry version; treat them as
  read-only. `getMarkdownTextTransforms` returns early when no inline or semantic registration
  exists, and Live Preview skips the pass via `hasMarkdownTextRegistrations()`.
- Import callout helpers from their direct modules instead of the `callouts` barrel in renderer
  internals so pipeline and plugin chunks do not pull unrelated exports.
- Keep callout definition lookups indexed by type and alias. Avoid repeated linear scans in renderer
  hot paths.
- Keep unified pipeline plugin helpers local unless they are exported through `src/index.ts` as part
  of the renderer package API.
- Renderer feature detection is per render and travels through VFile data. Do not use shared mutable
  feature state on the cached renderer because concurrent renders may overlap.
- Math rendering stays lazy: detect math per render, load `remark-math` and KaTeX only for notes
  with accepted math delimiters, and keep DOM/CSS loading out of `@cortex/renderer`.
- Built-in transform skips are allowed only when no custom Markdown processors are active. Custom
  processors can add HAST that still needs callout, wiki-link, task-list, highlight, URL policy, and
  sanitizer handling.
- Markdown preprocessors run before parsing and only for `reading-view` and `export` surfaces.
  Validate surfaces transactionally and keep Live Preview out of Unified preprocessors/processors.
- Plugin preprocessors and processors must run in priority order, isolate failures on cloned or
  staged data, report diagnostics, and disable repeatedly failing or slow registrations for the
  session.

## Sanitized HTML Contract

- `Renderer.render(...)` returns `SanitizedMarkdownHtml` only after the unified pipeline has passed
  through the URL policy and `rehype-sanitize`.
- Keep the final URL policy and sanitizer after plugin processors and built-in HAST transforms such
  as semantic output, callouts, wiki links, task lists, and highlighting. Any new transform that
  creates HAST must run before the final sanitizer.
- Preprocessor output is untrusted Markdown input. It must still pass through the normal parser,
  URL policy, sanitizer, and HTML stringification pipeline.
- KaTeX HAST must be produced before the final sanitizer. Allow inline `span` styles only for
  descendants of `.katex`; strip plugin or arbitrary span styles outside that scope.
- Task-list rendering should preserve source offsets on task items when parser positions are
  available so Reading View can map checkbox toggles back to Markdown.
- React sinks should unwrap renderer output with `sanitizeRenderedMarkdownHtml(...)` instead of
  treating arbitrary strings as trusted HTML.

## Frontmatter

- Frontmatter fields are parsed through `@cortex/properties/frontmatter`; do not add a second YAML
  frontmatter parser here.

## Inline Marks and Code Chrome

- `rehypeInlineMarks` renders `#tag` as `<span class="markdown-tag" data-tag>` and `==text==` as
  `<mark class="markdown-highlight">`, skipping code, links, math, and mentions. Tags use
  `findInlineTags` from `@cortex/properties/tags`; highlights use `findInlineHighlights`, which Live
  Preview shares. Both are gated by the `hasInlineTags` / `hasHighlights` feature flags.
- `rehypeCodeChrome` wraps fenced `pre` blocks in `.markdown-code-block` with a language label and a
  `data-code-copy` button; Reading View owns the click.
- Callout definitions carry an `icon` name from `CALLOUT_ICON_PATHS`; Reading View and Live Preview
  draw the same inline SVG. Unknown icons fall back to the note icon.

## Mentions

- `rehypeWikiLinks` renders `@[[Name]]` as `<span data-mention class="mention">` instead of a wiki
  link; style it under `.markdown-surface span[data-mention]`.
