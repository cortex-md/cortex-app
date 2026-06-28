# @cortex/plugin-host-web

## Web Plugin Host

- This package owns the React/web host for portable plugin descriptors: `PluginViewRenderer`,
  `PluginModalHost`, `PluginSettingsRenderer`, settings control injection, DOM markdown style
  installation, community plugin discovery, and web bundle loading.
- It may import React, `@cortex/ui`, and browser DOM APIs. Do not put code from this package behind
  contracts consumed by the future mobile app.
- `usePluginStore` is a React hook over the vanilla `pluginStore` from `@cortex/plugin-host-core`.
  Do not create a second plugin registry or duplicate lifecycle state.
- Community plugin discovery loads vault-local plugin bundles through CJS `eval` or ESM `data:` URL
  import and then registers modules with `@cortex/plugin-host-core`.
- `CommunityPluginLoader.ts` owns web/desktop discovery and bundle loading. Lifecycle state remains
  in `@cortex/plugin-host-core`.
- `reloadCommunityPlugins(...)` must ask core for enabled community entries. Do not infer enabled
  state from discovered plugin directories or store records with `status: "loaded"`.
- CodeMirror externals are loaded only when a manifest declares `editor:extensions`; keep that
  behavior in the web loader because CodeMirror is not part of the portable public contract.
- Keep CodeMirror external loading single-flight during community plugin discovery so multiple
  editor-extension plugins do not trigger duplicate runtime imports.
- Community plugin reload phases are ordered: disable previously enabled plugins, rediscover vault
  plugins, then re-enable surviving plugins. Do not parallelize those phases.
- Plugin view descriptors are discriminated unions with top-level fields and optional `key`; never
  reintroduce `props`, free `className`, inline styles, arbitrary React components, or DOM event
  handlers into the public renderer.
- Plugin view descriptors should render through named React components, including recursive child
  descriptors, rather than `renderDescriptor(...)` calls inside JSX.
- Plugin view descriptor arrays may use `key` for stable child identity. Keep the positional
  fallback deterministic because the public descriptor contract does not require node IDs.
- Desktop Tailwind CSS must include `packages/plugin-host-web/src` in its `@source` list so renderer
  utility classes and UI primitive composition are emitted into the desktop bundle.
