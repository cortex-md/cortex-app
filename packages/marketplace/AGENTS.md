# @cortex/marketplace

## Surface Ownership

- `@cortex/marketplace` owns registry, README, install, uninstall, update, compatibility, and
  release-date state.
- Marketplace manifest metadata comes from `manifest.json` in the latest release asset first, then
  raw GitHub fallback. Keep plugin version, minimum app version, and capabilities cached in the
  shared marketplace store so desktop can render details without duplicating GitHub fetch logic.
- Desktop owns the Marketplace workspace surface, catalog/detail layout, commands, and browse entry
  points. Mobile owns its native plugin-only catalog/detail screens. Do not add workspace or Settings
  routing state to this package.
- Catalog search/filter/sort/grouping, detail action state (`install`/`update`/`uninstall`,
  compatibility), capability labels, and repository links live in `marketplaceSelectors.ts`. Desktop and
  mobile render from these selectors; do not duplicate them in app code.
- Install never enables a plugin. `installEntry` and `uninstallEntry` report failures through
  `MarketplaceCallbacks.notify` and resolve.
- Restricted mode text is shared from `marketplaceSelectors.ts`: `COMMUNITY_PLUGINS_WARNING`,
  `ALLOW_COMMUNITY_PLUGINS_CONFIRMATION` (turning `plugins.allowCommunity` on), and
  `getPluginEnableConfirmation(manifest)` (declared permissions through `getCapabilityLabel`, shown
  before enabling a community plugin). Desktop and mobile disable plugin install/update while
  community plugins are off; the host's reload is a no-op then, so install would fail closed anyway.
- Marketplace does not import plugin host packages. Desktop passes its `PluginHost` as
  `MarketplaceCallbacks.pluginHost` (structural `MarketplacePluginHost`). Install/update calls
  `pluginHost.reloadCommunityPlugins(dir)` (full reload, not discovery-only). Uninstall must disable
  the plugin before removing files and unregistering the community registration.
- Plugin install/update must preserve the previous plugin directory until the staged plugin has
  been promoted, the plugin host has reloaded, and the new plugin registration is visible. On
  failure, remove the staged plugin, restore the previous directory, and re-run host reload best
  effort without masking the original error.

## Theme Installation

- Theme installation always uses staging inside the vault themes directory.
- Parse the manifest, validate safe stylesheet paths, and verify both referenced assets exist before
  replacing an installed theme.
- Treat stylesheet contents as opaque browser CSS. Marketplace must not import a
  theme CSS parser.
- Preserve the previous installation until the staged theme has been promoted and runtime reload
  succeeds.
- On any failure, remove staging and restore the previous theme without masking the original error.
- Theme uninstall resolves the family name from the manifest before removing runtime registrations.

## Performance

- File discovery and release asset downloads may run independent reads/downloads in parallel, but
  promotion, backup, restore, reload, and plugin/theme activation steps must stay ordered.
- Plugin source-archive fallback installation is ordered as delete staging, recreate staging, then
  install source archive. Keep that dependency explicit.
- Registry fallback lookups may fetch branch candidates concurrently while preserving `main` before
  `master` result priority.

## Platform Test Mocks

- Marketplace tests that mock `getPlatform().app` should include the full app contract:
  `getCurrentAppVersion`, `openExternalUrl`, and `resolveFileAssetUrl`.

## Theme Families and Explicit Entry Kind

- `installEntry(entry, kind)` and `uninstallEntry(entry, kind)` take the entry kind; pass it from the
  surface instead of relying on `activeTab`.
- `findThemeFamily(entry, families)` matches a registry entry to an installed theme family by id or
  name; use it for "installed" checks and "Use theme" actions.
