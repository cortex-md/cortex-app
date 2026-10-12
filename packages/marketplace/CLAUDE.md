# CLAUDE.md — @cortex/marketplace

## Purpose

`@cortex/marketplace` provides the shared marketplace logic for browsing, installing, and uninstalling community plugins and themes from the Cortex registry at `cortex-md/registry` on GitHub.

This package is platform-agnostic — it uses `@cortex/platform` abstractions for HTTP and filesystem operations. Desktop (Electron) and mobile (Expo) both consume it; mobile browses plugins only.

## Package Structure

```
packages/marketplace/
  src/
    types.ts               # RegistryEntry, GitHubRelease, MarketplacePluginHost
    registryService.ts     # Fetch + cache registry JSON, README, release manifest metadata
    installService.ts      # Staged install/update/uninstall for plugins and themes
    updateService.ts       # Installed version vs latest release detection
    versionUtils.ts        # compareVersions, isVersionCompatible
    marketplaceStore.ts    # Zustand store for UI state and actions
    marketplaceSelectors.ts # Pure catalog/detail selectors shared by desktop and mobile
    index.ts               # Public exports
```

## Registry Format

The registry lives at `https://raw.githubusercontent.com/cortex-md/registry/main/`:
- `plugins.json` — array of `RegistryEntry`
- `themes.json` — array of `RegistryEntry`

```typescript
interface RegistryEntry {
  id: string
  name: string
  author: string
  authorUrl?: string      // optional author website / profile URL
  description: string
  coverImageUrl: string   // may be empty string
  repo: string            // "owner/repo"
}
```

## Installation Flow

Plugins:
1. Fetch `https://api.github.com/repos/{owner}/{repo}/releases/latest`
2. Install into a hidden staging directory first, then promote to `.cortex/plugins/<id>` only after validation succeeds
3. Prefer release assets: download `manifest.json`, validate `manifest.id` and safe relative `manifest.main`, download the declared bundle asset, and optionally download `styles.css`
4. If required assets are missing, fall back to `zipball_url`, extract it, locate `manifest.json`, the declared main bundle, and optional `styles.css`, then normalize them into the staging directory
5. Re-run plugin discovery and confirm the plugin is registered; failed installs clean up staging/final folders and expose the runtime load error in marketplace UI. Plugin bundles may be CommonJS or self-contained ESM with a default plugin class export.

Themes:
1. Fetch latest release
2. Download `manifest.json`, parse it to get colorscheme file names
3. Download each colorscheme CSS file (e.g. `dark.css`, `light.css`)
4. Re-run theme discovery

## Bridge Pattern

`setMarketplaceCallbacks(callbacks)` is called once by each app host:

- Desktop `apps/desktop/src/bootstrap/desktopHost.ts`: `getPluginsDir: pluginHost.getCommunityPluginsDir`,
  `<vault>/.cortex/themes`, the desktop `PluginHost`, `reloadCommunityThemes`, theme-family checks, and
  `notify` through core native notifications.
- Mobile `apps/mobile/src/bootstrap/marketplace.ts`: `mobilePluginHost`, no themes directory
  (`getThemesDir: () => null`, `isThemeInstalled: () => false`), and `notify` through `reportAppError` for
  failures plus a `dialog.showAlert` after an install.

Installing never enables a plugin; the user enables it in plugin settings. `installEntry` and
`uninstallEntry` report failures through `notify` and resolve instead of rejecting.

Install/update relies on the platform fs contract: `downloadFile`, `downloadAndExtract` (strip the archive
top-level folder with `@cortex/platform/vault` `archiveEntrySegments`), `createDir`, `renameFile` and
`deleteFile` on directories (recursive), and `listDir` hiding dot-names. The staging workspace is
`<pluginsDir>/.<id>-install-<timestamp>`.

## Store Filtering and Sorting

The store exposes `filterInstalled: boolean` and `sortOrder: "default" | "newest" | "oldest"` state with corresponding setters. Both reset to defaults when `setActiveTab()` is called. Filtering, sorting, grouping, and detail action state live in `marketplaceSelectors.ts`; app surfaces must use them instead of re-implementing catalog logic. Date-based sorting lazily fetches `published_at` from the GitHub releases API via `loadReleaseDates()` (triggered automatically when sort order changes from "default"), cached in `releaseDates: Record<string, string>`. Compatibility checks read `minAppVersion` from the latest release `manifest.json` asset first, then fall back to raw `manifest.json` on `main`/`master` for source-based packages.

## Key Exports

- `useMarketplaceStore` — Zustand store with all UI state and actions
- `setMarketplaceCallbacks(cbs)` — Wire platform-specific callbacks (call once at app init)
- `isEntryInstalled(id, tab)` — Check if a plugin/theme is installed
- `selectMarketplaceEntries(state, { isInstalled })` — Search, installed filter, and release-date sort
- `groupMarketplaceEntries(entries, { isInstalled, availableUpdates })` — Updates / Installed / Available groups
- `getMarketplaceEntryState(state, id, installed)` — `install` / `update` / `uninstall` action, update version, `incompatible`
- `getCapabilityLabel`, `formatManifestValue`, `marketplaceSortLabels`, `matchesEntry`
- `getRepositoryUrl`, `getRepositoryLabel`, `getExternalUrl` — Registry link helpers
- `RegistryEntry` — Type for registry entries
- `MarketplaceSortOrder` — `"default" | "newest" | "oldest"`
- `fetchPluginRegistry() / fetchThemeRegistry()` — Fetch with in-memory cache
- `fetchReadme(repo)` — Fetch README.md from GitHub (tries main, then master branch)
- `fetchManifestMinVersion(repo)` — Fetch minAppVersion from release asset manifest first, then raw source manifest
- `invalidateRegistryCache()` — Force re-fetch on next loadRegistry()

## Dependencies

- `@cortex/platform` — `getPlatform().http.fetch()` for network, `getPlatform().fs` download/extract/rename/delete for install
- `@cortex/theme` — `getThemeManager()` for theme registration checks
- `zustand` + `immer` — state management
