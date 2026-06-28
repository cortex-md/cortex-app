# Publishing and Marketplace

Marketplace installs community themes from release assets into the active vault.

## Required Release Assets

Publish:

```text
manifest.json
light.css
dark.css
```

The CSS filenames can differ when the manifest references different safe relative paths.

For each colorscheme, Cortex looks for:

1. The exact relative path from `manifest.colorschemes`.
2. The basename of that path.
3. `<colorscheme>.css`, such as `light.css` or `dark.css`.

## Manifest Checks

Marketplace installation verifies:

- `manifest.json` is valid JSON.
- `manifest.id` matches the Marketplace registry entry id.
- `colorschemes.light` and `colorschemes.dark` are safe relative paths.
- Both stylesheet assets exist before replacing an installed theme.

## Install and Rollback Behavior

Cortex installs into:

```text
<vault>/.cortex/themes/<theme-id>
```

Theme install and update use staging inside the vault themes directory. Cortex preserves the
previous installation until staging is promoted and community themes reload successfully. On
failure, it removes staging and restores the previous theme best effort.

## Release Checklist

1. Include `manifest.json`.
2. Include both light and dark CSS assets.
3. Keep stylesheet paths relative and free of `..`.
4. Test applying the theme from light, dark, and system appearance modes.
5. Test uninstall while the theme is active.

