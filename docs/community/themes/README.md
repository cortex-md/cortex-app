# Community Themes

Community themes are vault-scoped CSS themes. Cortex discovers theme folders in the active vault,
parses each `manifest.json`, registers a light/dark theme family, and loads only the active CSS
variant on demand.

## Install Location

```text
<vault>/.cortex/themes/<theme-id>/
  manifest.json
  light.css
  dark.css
```

## Start Here

- [Getting started](getting-started.md)
- [Manifest](manifest.md)
- [CSS variables](css-variables.md)
- [Stable hooks and selectors](stable-hooks-and-selectors.md)
- [Markdown and callouts](markdown-and-callouts.md)
- [Light, dark, and system modes](light-dark-and-system.md)
- [Publishing and Marketplace](publishing-and-marketplace.md)
- [Best practices](best-practices.md)

## Mental Model

- The manifest describes identity and stylesheet paths.
- The CSS files define variables and targeted rules.
- Cortex injects community CSS directly and lets the browser own the cascade.
- Theme CSS should be scoped to `body.theme-<theme-name>-light` and
  `body.theme-<theme-name>-dark`.

