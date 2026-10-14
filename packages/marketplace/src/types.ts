export interface RegistryEntry {
	id: string
	name: string
	author: string
	authorUrl?: string
	description: string
	coverImageUrl: string
	repo: string
}

export interface MarketplaceManifestMetadata {
	version: string | null
	minAppVersion: string | null
	capabilities: string[]
}

export interface GitHubRelease {
	tag_name: string
	published_at: string
	assets: GitHubReleaseAsset[]
	zipball_url: string
}

export interface GitHubReleaseAsset {
	name: string
	browser_download_url: string
}

export interface MarketplacePluginHost {
	reloadCommunityPlugins(pluginsDir: string): Promise<void>
	disablePlugin(pluginId: string): Promise<void>
	unregisterCommunityPlugin(pluginId: string): void
	isPluginInstalled(pluginId: string): boolean
	getCommunityPluginLoadError(pluginId: string): string | null
}

export type MarketplaceKind = "plugin" | "theme"

export type MarketplaceAuditStatus = "pass" | "warn" | "fail"

export interface MarketplaceAudit {
	status: MarketplaceAuditStatus
	checkedTag: string
	checkedAt: string
	issues: string[]
}

export interface MarketplaceDiscussion {
	number: number
	nodeId: string
	url: string
}

export interface MarketplaceItemStats {
	downloads?: number
	stars?: number
	votes?: number
	latest?: string
	releasedAt?: string
	discussion?: MarketplaceDiscussion
	audit?: MarketplaceAudit
}

export interface MarketplaceStats {
	generatedAt: string | null
	plugins: Record<string, MarketplaceItemStats>
	themes: Record<string, MarketplaceItemStats>
}

export interface VerifiedEntry {
	kind: MarketplaceKind
	id: string
	since: string
}

export interface BlockedEntry {
	kind: MarketplaceKind
	id: string
	repo: string
	reason: string
	versions: string[] | null
	since: string
}
