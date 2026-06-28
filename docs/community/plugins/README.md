# Community Plugins

Community plugins extend Cortex through the public `@cortex.md/api` package. The host creates a
plugin instance, injects `this.manifest` and `this.api`, calls `onload()`, and disposes tracked
registrations when the plugin unloads.

## Install Location

During development, place or symlink a plugin directory here:

```text
<vault>/.cortex/plugins/<plugin-id>/
  manifest.json
  dist/index.js
  styles.css        # optional, Markdown-surface styles only
```

Cortex watches the vault plugin directory and reloads enabled community plugins when plugin files
change.

## Start Here

- [Getting started](getting-started.md)
- [Manifest and capabilities](manifest-and-capabilities.md)
- [Lifecycle and bundling](lifecycle-and-bundling.md)
- [Commands and hotkeys](commands-and-hotkeys.md)
- [Vault, editor, and workspace](vault-editor-workspace.md)
- [Markdown and properties](markdown-and-properties.md)
- [Views, settings, and UI](views-settings-and-ui.md)
- [Storage, bookmarks, and notifications](storage-bookmarks-notifications.md)
- [Publishing and Marketplace](publishing-and-marketplace.md)
- [Example: GitHub emoji plugin](examples/github-emoji.md)

## Rules of Thumb

- Import only from `@cortex.md/api` and your own bundled code.
- Declare every required capability in `manifest.json`.
- Use vault-relative paths with forward slashes.
- Use declarative views instead of React or DOM APIs.
- Keep view state serializable and update it through actions and reducers.
- Dispose manual timers, external subscriptions, and caches in `onunload()`.

