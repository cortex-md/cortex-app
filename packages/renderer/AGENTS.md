# @cortex/renderer

## Performance

- Import callout helpers from their direct modules instead of the `callouts` barrel in renderer
  internals so pipeline and plugin chunks do not pull unrelated exports.
- Keep callout definition lookups indexed by type and alias. Avoid repeated linear scans in renderer
  hot paths.
- Keep unified pipeline plugin helpers local unless they are exported through `src/index.ts` as part
  of the renderer package API.
- Renderer feature detection is per render and travels through VFile data. Do not use shared mutable
  feature state on the cached renderer because concurrent renders may overlap.
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
- Task-list rendering should preserve source offsets on task items when parser positions are
  available so Reading View can map checkbox toggles back to Markdown.
- React sinks should unwrap renderer output with `sanitizeRenderedMarkdownHtml(...)` instead of
  treating arbitrary strings as trusted HTML.
