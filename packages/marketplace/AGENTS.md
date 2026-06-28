# @cortex/marketplace

## Surface Ownership

- `@cortex/marketplace` owns registry, README, install, uninstall, update, compatibility, and
  release-date state.
- Marketplace manifest metadata comes from `manifest.json` in the latest release asset first, then
  raw GitHub fallback. Keep plugin version, minimum app version, and capabilities cached in the
  shared marketplace store so desktop can render details without duplicating GitHub fetch logic.
- Desktop owns the Marketplace workspace surface, catalog/detail layout, commands, and browse entry
  points. Do not add workspace or Settings routing state to this package.
- Marketplace must depend only on `@cortex/plugin-host-core` for plugin host state and lifecycle
  cleanup. It must not import `@cortex/plugin-host-web`.
- The plugin install/update callback is `reloadPluginHost(dir)`: desktop wires it to the platform
  host's full reload path, not discovery-only. Uninstall must disable the plugin before removing
  files and unregistering the community registration.
- Plugin install/update must preserve the previous plugin directory until the staged plugin has
  been promoted, the plugin host has reloaded, and the new plugin registration is visible. On
  failure, remove the staged plugin, restore the previous directory, and re-run host reload best
  effort without masking the original error.

## Theme Installation

- Theme installation always uses staging inside the vault themes directory.
- Parse the manifest, validate safe stylesheet paths, and verify both referenced assets exist before
  replacing an installed theme.
- Treat stylesheet contents as opaque browser CSS. Marketplace must not import
  `@cortex/theme-mobile` or a theme CSS parser.
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
