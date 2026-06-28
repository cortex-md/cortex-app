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
