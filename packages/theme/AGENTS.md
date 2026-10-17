# @cortex/theme

## Responsibilities

- Own built-in theme tokens, CSS variable generation, theme families, contrast utilities, and the
  public community theme contract.
- Keep theme decisions independent from React and desktop feature state.
- Export lightweight JSON validation through `parseCommunityThemeManifest`.
- Keep community stylesheet contents opaque. This package must not depend on CSS AST parsers.

## Community Themes

- `apps/web/src/content/docs/themes/` is the public theme-authoring contract for community manifests,
  variables, and stable selector hooks.
- Community manifests contain identity, metadata, and safe relative paths for light and dark CSS.
- Community manifests are discovered eagerly, but desktop loads and injects only the active
  community theme variant on demand.
- There is no API version before release. The current manifest shape is the only supported shape.
- Desktop injects community CSS directly and lets the browser own parsing, cascade, selectors, and
  `var()` resolution.
- Adding, removing, or renaming public CSS variables or stable selector hooks requires updating
  `apps/web/src/content/docs/themes/` and the matching contract tests.
- Theme tokens own typography defaults. Desktop Settings should emit runtime overrides only for
  explicit non-default user preferences; explicit user overrides may remain stronger than theme CSS.
- Community family placeholder themes use the matching built-in light/dark tokens as generator
  fallbacks. Do not register community themes with partial or cast-empty `ThemeTokens`.
- `paperTheme` and `inkTheme` are the single palette source for desktop CSS and mobile native
  fallback colors; keep token objects importable without DOM or React Native runtime.
- Built-in and custom accents must provide at least 4.5:1 contrast for text and 3:1 for focus
  indicators. Use the exported contrast resolvers instead of fixed light foregrounds.

## Token Rules

- Built-in primitive token objects keep the legacy `ink`, `amber`, and `amberDark` keys for package
  compatibility, while `cssGenerator` emits `slate`, `rose`, and `rose-d` aliases for the
  design-system palette. `stone` is the warm Stone neutral scale that Paper builds on; the optional
  `mist` key keeps the previous cool scale emitted as `--mist-*` for community themes.
- `cssGenerator` emits `--brand*` as public aliases of `semantic.accent.*`. Do not create a separate
  brand palette; desktop CSS and `@cortex/ui` should read the same accent source.
- Built-in light backgrounds should stay on the warm Stone neutrals and low-chroma. Built-in dark backgrounds
  should stay graphite-neutral, close to Minimal-style `#1e1e1e`, `#282828`, and `#373737`
  surfaces, without blue or purple drift. `rose` is the accent family for actions, selection,
  focus, and explicit accent states, not the general app surface.
- Built-in Markdown headings (Markdown v3) use ink (`text.primary`) on a real scale: H1 1.4em,
  H2 1.22em, H3 1.08em, H4 1em, H5-H6 0.9em. Structure comes from margin marks drawn by the editor
  CSS (an accent bar for H2, a muted dot for H3), not from per-level heading colors.
- `fonts.mono` must be a real monospace stack; anything reading `--font-mono` (inline code, list
  numbers, code labels, paths) relies on it.
- Built-in codeblock typography uses `--markdown-code-font-family` and
  `--markdown-code-font-size`, defaulting to Menlo at 14px. Community themes may override those CSS
  variables directly without manifest changes.
- `markdown.inlineCodeColor`, `markdown.linkMarkColor`, and `markdown.highlightColor` feed
  `--markdown-inline-code-color`, `--markdown-link-mark-color`, and `--markdown-highlight-color`.
  Built-in callouts use eight color families (blue, teal, green, amber, orange, red, violet, gray)
  with a soft background mixed from the family color over `bg.primary`.
- Feedback states require solid, background, foreground, border, and on-solid values.
- Settings groups use `settingsGroupBg`, `settingsGroupBorder`, and `settingsGroupDivider`.
- Sidebar hierarchy guides use `sidebarGuide`, exposed as `--sidebar-tree-guide`.
- `ThemeAdapter.applyTheme` receives the effective light or dark scheme and adapters expose it as
  `data-theme-scheme`.
- `getThemeManager()` may be called by bridge setup before desktop startup finishes. Keep
  `initThemeManager(...)` idempotent and able to attach the browser adapter/CSS generator to an
  already-created singleton before applying and injecting built-in theme CSS.
- App-level aliases derive from base variables. Community themes should not duplicate private
  shadcn aliases.
