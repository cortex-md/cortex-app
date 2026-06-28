# @cortex/theme-mobile

## Responsibilities

- Convert community theme CSS into portable token maps for the future React Native app.
- Use PostCSS only inside this package and expose extraction through `extractThemeTokenMap`.
- Collect custom properties only from top-level `:root` and the selected light or dark selector.
  Ignore nested `@media`, `@supports`, and other conditional token rules until mobile defines an
  explicit conditional token model.
- Resolve transitive `var()` references, fallbacks, and cycles using optional base tokens.

## Isolation

- This package is opt-in and must not be imported by `@cortex/theme`, Marketplace, or desktop code.
- Do not re-export it from `@cortex/theme`.
- Do not add cache, hashing, sync, React providers, or React Native integration here. Those belong
  to the future mobile app.
- Ignore non-token declarations and unsupported rules. Mobile extraction limitations never make a
  theme invalid for desktop.

## Performance

- `resolveValue` scans CSS strings for positional `var(` matches with a single pass over the
  string. Keep that parser string-oriented; do not rewrite it as array membership or token-set
  logic.
