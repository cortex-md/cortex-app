export { installPlugin, installTheme, uninstallPlugin, uninstallTheme } from "./installService"
export {
	isEntryInstalled,
	type MarketplaceCallbacks,
	type MarketplaceNotificationEvent,
	type MarketplaceSortOrder,
	type MarketplaceState,
	type MarketplaceTab,
	setMarketplaceCallbacks,
	useMarketplaceStore,
} from "./marketplaceStore"
export {
	fetchLatestRelease,
	fetchManifestMetadata,
	fetchManifestMinVersion,
	fetchPluginRegistry,
	fetchReadme,
	fetchThemeRegistry,
	invalidateRegistryCache,
} from "./registryService"
export type {
	GitHubRelease,
	GitHubReleaseAsset,
	MarketplaceManifestMetadata,
	RegistryEntry,
} from "./types"
export { detectAvailableUpdates, readInstalledVersion } from "./updateService"
export { compareVersions, isVersionCompatible } from "./versionUtils"
