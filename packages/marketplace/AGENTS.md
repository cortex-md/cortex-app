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

## Extension Sync

- `extensionSync/` owns the "Plugin configuration" and "Theme configuration" sync toggles for
  desktop and mobile: `.cortex/plugins.sync.json` `{ version: 1, plugins: [{ id, version, enabled,
  bundled? }] }` and `.cortex/themes.sync.json` `{ version: 1, themes: [{ id, version }] }`. The
  active theme stays in `appearance.theme` (`app.json`, `syncSettings`); never duplicate it here.
- `plan.ts` holds the only rules, as pure functions with tests: `deriveManifest` (writer: local
  items plus remote items not applied here, dropping only ids this device had synced and then
  removed; sorted by id, no timestamps), `planReconcile` (install missing, update older, never
  downgrade; uninstall only ids in local `known` that disappeared remotely; local-only items are
  merged back by the writer; community plugins enable only when bundled or `approved` on this
  device, else they install disabled and wait for approval; restricted mode leaves community items
  untouched), and `summarizeSync` for the status line.
- `startExtensionSync(services)` is the runtime. Apps pass structural services (vault, sync flags,
  `plugins.allowCommunity`, `selectPluginSyncSnapshot` from `usePluginStore`, enable/disable/save
  from their plugin host, idle scheduling); desktop `features/extensions/extensionSync.ts` and mobile
  `features/extensions/extensionSync.ts` only wire stores. It starts at idle once
  `loadedVaultPath` matches the open vault, writes the manifests through `getStateFile` (only when
  the canonical content changes), watches `.cortex` for manifest edits that differ from its last
  canonical content, and reconciles only while the matching toggle is on. Installs go through
  `installEntry(entry, kind, { version, quiet })` (blocklist and staging rules apply) one at a time,
  because install/reload steps must stay ordered; ids missing from the registry (sideloaded) are
  never installed and show as "not available here". The registry is fetched only when something
  must be installed or updated.
- `useExtensionSyncStore` holds `{ plugins, themes }` status; `formatExtensionSyncStatus` and
  `needsExtensionSyncReview` are the shared copy for desktop and mobile sync preferences.
- `installEntry`/`uninstallEntry` resolve to `true` on success and emit
  `subscribeInstalledExtensions(kind)` so the writer refreshes after Marketplace changes.
  `fetchReleaseForVersion(repo, version)` tries `v<version>` and `<version>` tags, then the latest
  release.

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
