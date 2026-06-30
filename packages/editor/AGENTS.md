# @cortex/editor

## Reading View

- `ReadingView` keeps rendered HTML tied to the source Markdown content and renderer registry
  version. Do not show a previous note's rendered HTML while an async render for the current content
  is still pending.
- Live Preview consumes portable inline/semantic Markdown registrations only. Do not run Unified
  preprocessors or processors in Live Preview; those are renderer/export surfaces.
- Live Preview math uses the shared renderer math scanner for visible inline ranges and block
  indexing, but renders KaTeX through lazy widgets only when the projected widget mounts.
- `SideBySideView` pairs an editable Live Preview editor with a rendered Reading View. Do not
  regress it to raw Markdown plus Reading View, and keep local asset resolution wired through the
  editable side.
- `EditorView` must reconfigure the Live Preview projection when `livePreview`, file path, or image
  URL resolution props change. Mode switches must not leave an existing CodeMirror view in raw
  source mode.
- `ReadingView` receives `SanitizedMarkdownHtml` from `@cortex/renderer`; keep
  `sanitizeRenderedMarkdownHtml(...)` at the React HTML sink so the trust boundary stays explicit.
- Components that render `.markdown-surface` must import `src/markdown.css` directly, because
  desktop callers use narrow subpath exports and cannot rely on the root editor barrel for styles.
- Delegated DOM listeners in `ReadingView` should subscribe once and call host callbacks through
  `useEffectEvent` so callback prop changes do not rebuild listeners.
- Reading View code-block embeds are host-rendered React slots over fenced code blocks. Keep the
  parser and slot contracts generic in `@cortex/editor`, and keep heavy renderers such as drawing,
  diagram, or canvas libraries in desktop-owned lazy chunks instead of importing them here.
- Reading View loads the KaTeX stylesheet through `mathStylesheet.ts` only after rendered HTML
  contains `.katex`; keep KaTeX CSS/DOM loading out of `@cortex/renderer`.
- Live Preview code-block embeds are lightweight DOM previews that replace only same-line source
  ranges and use the existing code-block chrome for actions. Keep callbacks host-owned and keep
  heavyweight renderers out of `@cortex/editor`.
- Host-owned Live Preview embeds that mount external UI should set `CodeBlockEmbedLivePreview.signature`
  from the source/content they render so CodeMirror can remount stale widgets when the fenced block
  changes without changing the visible title or chrome metadata.

## Performance

- Desktop imports should use narrow `@cortex/editor/*` subpaths when they need only commands,
  ReadingView, EditorView, SideBySideView, keymap helpers, or types. Reserve the root barrel for
  tests or callers that truly need the full editor surface.
- Callout registry access is available from `@cortex/editor/callouts`; desktop context menus and
  other small consumers should use that subpath instead of the root editor barrel.
- Live Preview codeblock and callout backgrounds must be painted behind the editable content layer,
  not as wrapper backgrounds that cover CodeMirror selection. Keep the block styling visible while
  preserving native selection, Vim visual mode, and cursor mapping.
- Fenced code blocks stay Markdown-owned. Keep syntax highlighting available through Markdown code
  languages, but do not enable code-editor suggestion panels or completion helpers inside note code
  fences unless this becomes an explicit editor feature with lazy loading and tests.
- Fenced code block chrome belongs in an absolute overlay anchored to the opening fence line:
  raw language slug badge when idle, copy button on hover. Keep it out of source text flow and do
  not add left padding to code lines just to make room for chrome.
- Fenced code block content uses `--markdown-code-font-family` and
  `--markdown-code-font-size`; inline code keeps `--font-editor`. Keep
  `--markdown-code-padding-inline` applied symmetrically in Reading View and Live Preview.
- Markdown list markers and task checkboxes must stay visually aligned between Reading View and
  Live Preview. Share task checkbox styling through markdown CSS variables and keep Live Preview
  widgets backed by Markdown source changes instead of separate checkbox state.
- Markdown heading typography must stay aligned across Reading View, Live Preview, and CodeMirror
  syntax highlighting. Built-in themes use a compact Minimal-style scale where H1/H2 are only
  slightly larger than body text, H3 stays near body size, H4-H6 may step down, and CodeMirror
  heading tags use `--heading-font-weight` rather than hard-coded weights.
- Scroll listeners that only mirror scroll position should be passive.
- Production CodeMirror value imports must stay behind `loadEditorRuntime()` in `runtime.ts`.
  Editor React components, commands, keymaps, Live Preview, Vim, and clipboard helpers receive the
  runtime or expose factories instead of importing `@codemirror/*` directly.
- Slash command behavior belongs in `@cortex/editor` as a runtime-backed extension that scans only
  the current line and incremental Lezer syntax state. Desktop may render the menu, but it should
  pass command metadata and execution callbacks instead of duplicating Markdown command logic.
- Markdown command keymaps are host-injected. `markdownKeymap.ts` receives bindings plus a command
  executor and must not maintain its own `format.*` or `table.*` command map. Toolbar, slash menu,
  context menu, hotkeys, and Vim should all execute the same `@cortex/commands` entries.
- Shared Markdown formatting command metadata and handlers live in `markdownFormatCommands.ts` and
  are exported as `@cortex/editor/markdown-format-commands`. Desktop and mobile hosts may register
  those entries in their own command registry context, but must not duplicate the `format.*`
  catalog.
- Math insertion stays in the same `format.*` command catalog. Toolbar, slash menu, context menu,
  and palette surfaces should execute `format.inline-math` and `format.math-block` rather than
  calling math insertion helpers directly.
- Folding belongs in `folding.ts` as a runtime-backed CodeMirror extension. Built-in folds should
  cover Markdown structures without replacing source text, while plugin fold providers remain
  portable line-based contracts passed through `pluginFoldingExtension`.
- CodeMirror contracts may use type-only imports from `@codemirror/*`; keep runtime module shapes
  explicit so lazy-loaded features do not fall back to `any`.
- Tests and benchmarks may import CodeMirror directly when they are exercising the editor engine in
  isolation. Keep benchmark-only files in root `tools/benchmarks/`, not under `packages/editor/src/`,
  so source graph tooling does not treat them as production files.
- Keep CodeMirror/theme dependencies in `package.json` only when runtime code, tests, or benchmarks
  import them directly.

## Table Editing

- Markdown tables remain source-owned. Structural table commands should rewrite one normalized
  Markdown table block in a single dispatch, without storing visual-only table metadata.
- Keep collapsed cursors inside rendered Live Preview table cells mapped to source positions.
  Live Preview table interactions should stay rendered; selection crossing cells should become
  transient visual cell/table selection rather than revealing Markdown source. Text selection fully
  inside one rendered cell may stay native.
- Rendered Live Preview table cells need real pointer hit targets, including empty cells and cell
  padding. Pointer placement should dispatch to the Markdown cell source position instead of relying
  on hidden pipe syntax.
- Empty rendered cells must keep an editable source span for CodeMirror's native input path.
  Tests should cover DOM input and ArrowUp/ArrowDown table entry, not only direct dispatch changes.
- Table layouts must stay responsive in Live Preview and Reading View together: compact tables may
  fit their contents, long cell text should wrap, and wide/many-column tables should scroll
  horizontally inside the table wrapper instead of widening the note.
- Compact table columns should size from content first. Do not stretch all columns to fill the note;
  only the column whose content grows should widen, with the same width applied across that column.
- Live Preview table rows and cells should use CSS table layout over source-mapped ranges so the
  browser aligns columns across header and body while inline Markdown spans remain editable. Do not
  store per-column width metadata on cells, and avoid extra active-cell marks that can split cell
  boxes when the cursor enters inline content.
- Delimiter rows must remain source-mapped but visually hidden in collapsed Live Preview. Do not let
  `---`, `:---`, or `---:` leak below the header in idle rendered mode.
- Table pointer placement should prefer geometric row/cell hit testing so padding and empty visual
  space inside a cell focus the Markdown cell instead of requiring a click directly on text.
- Shared rendered-table pointer, row, cell, and measurement helpers live in `tablePointer.ts`; table
  selection, resize, and affordance plugins should reuse that module instead of duplicating hit
  testing.
- Vim table navigation should reuse the Markdown table movement helpers. Keep normal-mode
  `h`/`j`/`k`/`l` table-aware only at cell boundaries or vertical table entry points, without
  duplicating command registry data or breaking insert/visual/command-line modes.
- Table paste handling may expand rows and columns, but v1 table cells stay single-line Markdown
  spans; do not add formulas, merged cells, drag handles, or persisted width state without a new
  feature decision.
- Table alignment, move, duplicate, add-at-end, copy, and structured-selection conversion commands
  are Markdown-native table rewrites. Alignment belongs only in delimiter cells (`---`, `:---:`,
  `---:`), copy commands must not persist state, and native range selection, density controls,
  header-column metadata, or visual table schemas require a new feature decision.
- Table column resize is allowed only as transient Live Preview session state. Resize must apply to
  whole columns, keep header and body aligned, avoid Markdown/localStorage/settings metadata, and
  reset when the editor session is recreated.
- Table row and column handles are transient Live Preview overlays outside source-mapped cells.
  They are drag-only affordances for Markdown-native row/column reorder. Do not open editor-owned
  action menus from handles, persist metadata, resize columns, or alter CSS table geometry.
- Table handle visibility should be proximity-based around the top/left table edges and expanded
  handle gutters. Moving from a cell toward a handle must keep the affordance visible instead of
  clearing the target just because the pointer left the cell text box.
- Table edge expansion is a transient overlay: a right-edge plus adds a column at the end, and a
  bottom-edge plus adds a row at the end. The plus buttons must not change cell sizing or store
  visual state.
- Table context menus should derive the target cell from the contextmenu event without moving the
  editor selection. Move selection to that cell only when executing the chosen table command.
- Rectangular table cell selection is a transient Live Preview state, not CodeMirror text
  selection and not Markdown metadata. Keep the editor selection collapsed inside the table, paint
  selection with temporary cell classes, clear it on Escape, document changes, non-empty text
  selection, or table exit, and implement copy/clear/paste as Markdown-native table rewrites.
- Whole-table visual selection is also transient Live Preview state. Normal mouse drag may select
  the table visually as an element; Delete removes the Markdown table, and copy preserves Markdown
  table text without exposing raw source in the editor surface.
- Native text selection inside rendered table cell text must win over visual table selection.
  Start visual table selection from padding, empty cells, or explicit Shift gestures, not from a
  pointerdown whose coordinates hit real cell text.
- Table caret placement must clamp pointer-derived positions to `contentFrom/contentTo` for the
  target cell. A click in the visual space after a cell's text should place the caret at that cell's
  content end, not in hidden pipes or the adjacent cell.
- Table drag feedback belongs in the transient affordance overlay. Use animated preview/indicator
  elements and temporary row/column classes, not layout mutations, persisted metadata, or source
  rewrites before pointerup.
- Live Preview table borders should be a connected grid: the wrapper owns the outer perimeter and
  cells own internal dividers. Do not reintroduce per-cell outer borders that create disconnected
  corners or stray right-side lines.
