# @cortex/plugin-host-core

## Portable Plugin Host

- `createPluginHost(services: PluginHostServices)` is the only host entry point. Services are one
  typed object built by `@cortex/core` `createCoreServices()` plus host-specific `activeEditor`,
  `editorRuntime`, `theme`, and `community` (`{ styles, loadEditorExternals }`, or null when
  community plugins are unsupported). Missing services must stay compile errors; do not add
  module-level setters or optional `?.` bridges.
  The one optional service is `editorRuntime`: without it the host neither runs `editorExtensions`
  nor registers fold providers (a realm with no CodeMirror view).
- `ctx.editor.*` only calls `services.activeEditor` (`getFilePath`, `getContent`,
  `insertAtCursor`, `replaceSelection`) through `createPluginEditorApi`, which owns the
  `editor:read`/`editor:write` checks. `createCodeMirrorActiveEditor({ getFilePath })`
  (`activeEditor.ts`) is the single CodeMirror implementation over `getEditorViewRef()`, with
  positions taken from the live selection; desktop and the mobile WebView use it.
- Do not import React, React DOM, `@cortex/ui`, CodeMirror runtime values, browser DOM APIs, or
  Node-only modules here. `check:boundaries` enforces this.
- `usePluginStore` is the single contribution registry (views, sidebar items, status bar items,
  settings pages, context menu items, modals, plugin settings values). Core desktop contributions
  use owner `"core"` with unprefixed keys; plugin keys are `<pluginId>:<id>`. Register through
  `registerContributions(owner, set)` and remove an owner in one `clearOwnerContributions` call.
- Enabling a plugin loads its settings file, applies defaults, and registers its static
  contributions through `registerPluginContributions(definition, runtime)`
  (`pluginContributions.ts`, the only plugin command owner: commands in one `registerMany`, views,
  sidebar/status bar/context menu items, and the settings page). Status bar and context menu items
  run commands through `commandRegistry`. Handlers, `activate`, and `load()` run lazily on first
  command, first view render, or at enable for `activation: "startup"`. Everything is disposed
  together on disable.
- Runtime permission checks live only in `pluginContext.ts` (`requirePermission`). Context
  subscriptions are tracked and disposed with the plugin.
- `setEditorViewRef(view)` is a no-op for the current view. Every editor view it has seen receives
  plugin editor extensions and fold providers; do not reconfigure on focus changes.
  `registerEditorView(view)` adds a view (e.g. a split or background tab) without making it active;
  hosts call it for every created view.
- `editorSurface.ts` owns plugin editor contributions: `createEditorContributions` (extensions +
  fold providers, applied to every known view with a generation guard) and
  `registerMarkdownContributions` (inline rules with `when` settings, semantic rules, callouts). `pluginHost.ts` must use them instead of re-implementing them.
- `ctx.vault.onFileEvent` shares one platform watcher for all listeners and stops it when the last
  listener is disposed.

## Plugin Bridge

Plugins run in one realm with the real host (desktop renderer, mobile WebView). A UI realm without
plugin code (mobile native) mirrors the host's plugin UI over one JSON channel:

- `bridge/protocol.ts` is the single message set. Host → UI (`PluginHostMessage`): `register`
  (`serializePluginDefinition`: manifest, settings schema, function-free commands/views/items),
  `unregister`, `records` (all plugin records + load errors), `settings` (one owner's values or
  `null`), `modals` (plugin modal instances), `viewUpdate`, and `result`. UI → host
  (`PluginUiMessage`): `invoke` (`command`, `viewOpen`, `viewAction`, `viewClose`) and `control`
  (`enable`, `disable`, `unregister`, `setSetting`, `discover`, `reload`, `saveEnabled`,
  `closeModal`, `updateModalState`), each answered by one `result` with the same `id`.
- `createPluginHostMirror(host, send)` (host realm) sends the full state once, then only changed
  slices from `usePluginStore`. A plugin is registered in the UI while its record is `enabled`.
  `receive` runs `invoke` against the real host (commands through `commandRegistry`, views through
  one local `createPluginViewController` per `instanceKey`, after the view's `activate`) and
  `control` through the real host methods, so permission checks stay in `pluginContext.ts`.
- `createPluginUiMirror({ send, getVaultPath })` (UI realm) applies those messages to its own
  `usePluginStore` through `registerPluginContributions` with proxy commands and remote views
  (`RegisteredView.remote`), and exposes `facade`, a `MarketplacePluginHost`- and settings-UI
  compatible subset of `PluginHost` plus `closeModal`/`updateModalState` that forwards to the host.
  `dispose()` clears everything mirrored and rejects pending requests; the mirror stays usable
  after a host realm reload.
- Remote views (`bridge/remoteView.ts`): `createPluginViewController` returns the remote controller
  when `registration.remote` is set. It shows `loading` until the first `viewUpdate` for its
  `instanceKey`, opens with `viewOpen`, sends `viewAction` on dispatch, and `viewClose` from the
  cleanup that `activate()` returns (hosts call it as the effect cleanup).

## Rendering

- Rendering is headless here and framework-agnostic, so desktop (React DOM) and mobile (React
  Native) only map data to components:
  - `createPluginViewController(registration, initialState?)` owns all view logic: lazy `activate` (errors
    reported), `render(controlled?)` returning a `PluginViewSnapshot` (`loading`, `empty`, `ready`
    with a serializable `ViewDescriptor`, or a sticky `error`), and `dispatch(action, payload,
    controlled?)` that runs `reduce`, updates internal state (notifying `subscribe` listeners) or
    calls `controlled.onStateChange`, then fires `onAction`.
  - `selectVisibleStatusBarItems(state)` applies `when` against plugin settings and sorts by
    priority; `selectContextMenuItems(state, location, context)` returns runnable actions for one
    location; `resolvePluginSettingFields(schema, values)` applies defaults and normalizes values
    (number clamping) for settings forms. Hosts must use these instead of re-implementing them.

## Community Plugins

- `communityPlugins.ts` reads a plugin directory (`readCommunityPluginFiles`: validated
  `manifest.json` with an `id` and safe relative `main`, the bundle, and `styles.css` scoped with
  `scopePluginMarkdownStyles`, imported dynamically so `css-tree` stays out of the startup bundle)
  and evaluates it in the host realm (`evaluateCommunityPlugin`: CJS bundles with
  `require("@cortex.md/api")` or ESM `data:` imports, a validated default `definePlugin` export
  whose id matches the manifest). `services.community.loadEditorExternals()` loads the CodeMirror
  externals once, only for bundles that import `@codemirror/*`. `styles.css` requires markdown
  contributions (`assertCommunityStyles`). Load errors live in `usePluginStore().loadErrors`.
- Shared execution helpers live in `pluginRuntime.ts` (`activatePluginDefinition`,
  `getCommandHandler`, `bindPluginView`).
- Invalid `.cortex/plugins.json` fails closed. Missing files default-enable bundled plugins only.
- Reload phases stay ordered: disable enabled community plugins, rediscover, re-enable survivors.
- Restricted mode lives only here: `services.community.isAllowed()` (hosts read the app-level
  `plugins.allowCommunity` setting). While it is false, `discoverCommunityPlugins` (and so
  `reloadCommunityPlugins`) is a no-op, `enablePlugin` rejects community entries, and
  `saveEnabledPlugins` keeps enabled ids of unregistered community plugins so turning it back on
  restores them. `syncCommunityAccess()` applies a change: off disables and unregisters every
  community plugin and clears their load errors; on discovers the vault's plugins directory and runs
  `loadEnabledPlugins()`. Bundled plugins are never affected. There is no isolation; do not add a
  second gate in hosts or UI.
