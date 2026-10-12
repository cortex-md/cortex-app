export { installPlugin, installTheme, uninstallPlugin, uninstallTheme } from "./installService"
export {
	ALLOW_COMMUNITY_PLUGINS_CONFIRMATION,
	COMMUNITY_PLUGINS_WARNING,
	findThemeFamily,
	formatManifestValue,
	getCapabilityLabel,
	getExternalUrl,
	getMarketplaceEntryState,
	getPluginEnableConfirmation,
	getRepositoryLabel,
	getRepositoryUrl,
	groupMarketplaceEntries,
	type MarketplaceEntryAction,
	type MarketplaceEntryGroup,
	type MarketplaceEntryGroupKey,
	type MarketplaceEntryState,
	marketplaceSortLabels,
	matchesEntry,
	selectMarketplaceEntries,
	type ThemeFamilyReference,
} from "./marketplaceSelectors"
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
	MarketplacePluginHost,
	RegistryEntry,
} from "./types"
export { detectAvailableUpdates, readInstalledVersion } from "./updateService"
export { compareVersions, isVersionCompatible } from "./versionUtils"
