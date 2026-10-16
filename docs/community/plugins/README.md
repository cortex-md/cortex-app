# Community Plugins

Community plugins extend Cortex through the public `@cortex.md/api` package. A plugin is one
default-exported `definePlugin({...})` object: a manifest, a settings schema, and declared
contributions. Cortex registers the contributions without running plugin code, runs `activate` or
`load` on first use, and disposes everything together when the plugin is disabled.

## Install Location

During development, `cortex dev --vault <vault>` copies the build here (symlinks are not watched
for hot reload):

```text
<vault>/.cortex/plugins/<plugin-id>/
  manifest.json     # { "id", "main" }
  dist/index.js     # default export: definePlugin({...})
  styles.css        # optional, requires contributes.markdown
```

Cortex watches the vault plugin directory and reloads enabled community plugins when plugin files
change.

## Start Here

- [Getting started](getting-started.md)
- [Manifest and permissions](manifest-and-capabilities.md)
- [Lifecycle and bundling](lifecycle-and-bundling.md)
- [Commands and hotkeys](commands-and-hotkeys.md)
- [Vault, editor, and workspace](vault-editor-workspace.md)
- [Markdown and properties](markdown-and-properties.md)
- [Views, settings, and UI](views-settings-and-ui.md)
- [Storage, bookmarks, and notifications](storage-bookmarks-notifications.md)
- [Publishing and Marketplace](publishing-and-marketplace.md)

## Rules of Thumb

- Import only from `@cortex.md/api` and your own bundled code.
- Declare contributions as data; keep handlers small or move them behind `load()`.
- List only the runtime `permissions` your handlers actually call.
- Use vault-relative paths with forward slashes.
- Use declarative views instead of React or DOM APIs; keep view state serializable.
- Return a cleanup function from `activate` for timers or external resources.
