import { getPlatform } from "@cortex/platform"
import type { GitHubRelease, MarketplaceManifestMetadata, RegistryEntry } from "./types"

const REGISTRY_BASE = "https://raw.githubusercontent.com/cortex-md/registry/main"
const emptyManifestMetadata: MarketplaceManifestMetadata = {
	version: null,
	minAppVersion: null,
	capabilities: [],
}

let cachedPlugins: RegistryEntry[] | null = null
let cachedThemes: RegistryEntry[] | null = null
const cachedManifestMetadata: Record<string, MarketplaceManifestMetadata> = {}

interface ReleaseManifestResult {
	found: boolean
	metadata: MarketplaceManifestMetadata
}

export async function fetchPluginRegistry(): Promise<RegistryEntry[]> {
	if (cachedPlugins) return cachedPlugins
	const response = await getPlatform().http.fetch(`${REGISTRY_BASE}/plugins.json`)
	if (!response.ok) throw new Error(`Failed to fetch plugin registry: ${response.status}`)
	cachedPlugins = (await response.json()) as RegistryEntry[]
	return cachedPlugins
}

export async function fetchThemeRegistry(): Promise<RegistryEntry[]> {
	if (cachedThemes) return cachedThemes
	const response = await getPlatform().http.fetch(`${REGISTRY_BASE}/themes.json`)
	if (!response.ok) throw new Error(`Failed to fetch theme registry: ${response.status}`)
	cachedThemes = (await response.json()) as RegistryEntry[]
	return cachedThemes
}

export function invalidateRegistryCache(): void {
	cachedPlugins = null
	cachedThemes = null
	for (const repo of Object.keys(cachedManifestMetadata)) {
		delete cachedManifestMetadata[repo]
	}
}

export async function fetchLatestRelease(repo: string): Promise<GitHubRelease> {
	const response = await getPlatform().http.fetch(
		`https://api.github.com/repos/${repo}/releases/latest`,
		{ headers: { Accept: "application/vnd.github+json" } },
	)
	if (!response.ok) throw new Error(`Failed to fetch release for ${repo}: ${response.status}`)
	return (await response.json()) as GitHubRelease
}

async function fetchGitHubRaw(repo: string, filename: string): Promise<Response | null> {
	const responses = await Promise.all(
		["main", "master"].map((branch) =>
			getPlatform().http.fetch(`https://raw.githubusercontent.com/${repo}/${branch}/${filename}`),
		),
	)
	return responses.find((response) => response.ok) ?? null
}

export async function fetchReadme(repo: string): Promise<string> {
	const response = await fetchGitHubRaw(repo, "README.md")
	if (response) return response.text()
	throw new Error(`README not found for ${repo}`)
}

function createEmptyManifestMetadata(): MarketplaceManifestMetadata {
	return {
		version: emptyManifestMetadata.version,
		minAppVersion: emptyManifestMetadata.minAppVersion,
		capabilities: [],
	}
}

function normalizeCapabilities(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	const seen = new Set<string>()
	const capabilities: string[] = []

	for (const item of value) {
		if (typeof item !== "string") continue
		const capability = item.trim()
		if (!capability || seen.has(capability)) continue
		seen.add(capability)
		capabilities.push(capability)
	}

	return capabilities
}

function parseManifestMetadata(value: unknown): MarketplaceManifestMetadata {
	if (!value || typeof value !== "object") return createEmptyManifestMetadata()

	const manifest = value as {
		version?: unknown
		minAppVersion?: unknown
		capabilities?: unknown
	}

	return {
		version: typeof manifest.version === "string" ? manifest.version : null,
		minAppVersion: typeof manifest.minAppVersion === "string" ? manifest.minAppVersion : null,
		capabilities: normalizeCapabilities(manifest.capabilities),
	}
}

function parseManifestMetadataContent(content: string): MarketplaceManifestMetadata {
	try {
		return parseManifestMetadata(JSON.parse(content))
	} catch {
		return createEmptyManifestMetadata()
	}
}

async function fetchReleaseManifestMetadata(repo: string): Promise<ReleaseManifestResult> {
	let manifestAsset: GitHubRelease["assets"][number] | undefined
	try {
		const release = await fetchLatestRelease(repo)
		manifestAsset = release.assets.find((asset) => asset.name === "manifest.json")
	} catch {
		return { found: false, metadata: createEmptyManifestMetadata() }
	}
	if (!manifestAsset) return { found: false, metadata: createEmptyManifestMetadata() }

	try {
		const manifestContent = await getPlatform().http.download(manifestAsset.browser_download_url)
		return {
			found: true,
			metadata: parseManifestMetadataContent(manifestContent),
		}
	} catch {
		return { found: true, metadata: createEmptyManifestMetadata() }
	}
}

export async function fetchManifestMetadata(repo: string): Promise<MarketplaceManifestMetadata> {
	if (repo in cachedManifestMetadata) return cachedManifestMetadata[repo]

	const releaseManifest = await fetchReleaseManifestMetadata(repo)
	if (releaseManifest.found) {
		cachedManifestMetadata[repo] = releaseManifest.metadata
		return releaseManifest.metadata
	}

	const response = await fetchGitHubRaw(repo, "manifest.json")
	if (response) {
		try {
			const metadata = parseManifestMetadata(await response.json())
			cachedManifestMetadata[repo] = metadata
			return metadata
		} catch {
			const metadata = createEmptyManifestMetadata()
			cachedManifestMetadata[repo] = metadata
			return metadata
		}
	}

	const metadata = createEmptyManifestMetadata()
	cachedManifestMetadata[repo] = metadata
	return metadata
}

export async function fetchManifestMinVersion(repo: string): Promise<string | null> {
	return (await fetchManifestMetadata(repo)).minAppVersion
}
