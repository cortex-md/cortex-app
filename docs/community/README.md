# Community Documentation

Cortex community extensions are vault-scoped. The desktop app discovers plugins and themes inside
the active vault:

- Plugins: `<vault>/.cortex/plugins/<plugin-id>`
- Themes: `<vault>/.cortex/themes/<theme-id>`

## Guides

- [Plugin authoring](plugins/README.md)
- [Theme authoring](themes/README.md)

## Shared Principles

- Keep extension ids stable and package-like.
- Request only the capabilities or CSS reach you need.
- Prefer portable APIs and theme tokens over desktop-specific assumptions.
- Keep releases self-contained: publish `manifest.json` and the assets referenced by it.
- Test light and dark schemes, empty vaults, large vaults, and reload behavior.

