import type { IconNode } from "lucide-react"
import { dynamicIconImports } from "lucide-react/dynamic"
import type { MarketplaceKind } from "../content/marketplace"
import {
	defaultRegistryRepo,
	findBlockedEntry,
	getItemStats,
	isRepoSlug,
	isVerifiedEntry,
	parseBlockedEntries,
	parseRegistryEntries,
	parseRegistryManifest,
	parseRegistryStats,
	parseThemePalette,
	parseVerifiedEntries,
	registryFileUrl,
} from "../lib/registry/parse"
import type {
	BlockedEntry,
	RegistryEntry,
	RegistryManifest,
	RegistryStats,
	ThemePalette,
	VerifiedEntry,
} from "../lib/registry/types"
import { withCache } from "./cache"

export const CATALOG_CACHE_SECONDS = 300
const MANIFEST_TTL_SECONDS = 1800
const USER_AGENT = "Cortex website marketplace"

export interface MarketplaceItem {
	kind: MarketplaceKind
	id: string
	name: string
	author: string
	authorUrl: string | null
	description: string
	repo: string
	coverImageUrl: string | null
	screenshots: string[]
	iconNode: IconNode | null
	verified: boolean
	votes: number
	downloads: number
	version: string | null
	minAppVersion: string | null
	releasedAt: string | null
	discussionUrl: string | null
	discussionNumber: number | null
	capabilities: string[] | null
	palettes: ThemePalette[]
	appearance: string | null
}

export interface MarketplaceCatalog {
	status: "ok" | "unavailable"
	items: MarketplaceItem[]
	generatedAt: string | null
	isStale: boolean
}

export function getRegistryRepo() {
	const configured = process.env.CORTEX_REGISTRY_REPO?.trim()
	return configured && isRepoSlug(configured) ? configured : defaultRegistryRepo
}

async function fetchResponse(url: string, fetchImpl: typeof fetch) {
	try {
		const response = await fetchImpl(url, {
			headers: { "User-Agent": USER_AGENT },
			signal: AbortSignal.timeout(8000),
		})
		return response.ok ? response : null
	} catch {
		return null
	}
}

async function fetchJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
	const response = await fetchResponse(url, fetchImpl)
	if (!response) return null
	try {
		return await response.json()
	} catch {
		return null
	}
}

async function fetchText(url: string, fetchImpl: typeof fetch) {
	const response = await fetchResponse(url, fetchImpl)
	if (!response) return null
	try {
		const text = await response.text()
		return text.length <= 512_000 ? text : null
	} catch {
		return null
	}
}

async function cachedOptional<Value>(key: string, load: () => Promise<Value | null>) {
	const cached = await withCache({
		key,
		ttlSeconds: MANIFEST_TTL_SECONDS,
		tags: ["marketplace"],
		load,
	})
	return cached?.value ?? null
}

const cachedIconNodes = new Map<string, IconNode | null>()

function resolveLucideIconName(name: string) {
	const trimmed = name.trim()
	const kebab = trimmed
		.replace(/Icon$/u, "")
		.replace(/_/gu, "-")
		.replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
		.toLowerCase()
	return [trimmed, kebab].find((candidate) => candidate in dynamicIconImports)
}

async function resolveIconNode(name: string | null | undefined): Promise<IconNode | null> {
	if (!name) return null
	const resolved = resolveLucideIconName(name)
	if (!resolved || !(resolved in dynamicIconImports)) return null
	const cached = cachedIconNodes.get(resolved)
	if (cached !== undefined) return cached
	try {
		const iconModule = (await dynamicIconImports[
			resolved as keyof typeof dynamicIconImports
		]()) as unknown as { __iconNode?: IconNode }
		const node = iconModule.__iconNode ?? null
		cachedIconNodes.set(resolved, node)
		return node
	} catch {
		return null
	}
}

function releaseAssetUrl(repo: string, fileName: string) {
	return `https://github.com/${repo}/releases/latest/download/${fileName}`
}

function rawFileUrl(repo: string, fileName: string) {
	return `https://raw.githubusercontent.com/${repo}/main/${fileName}`
}

export function fetchManifest(repo: string, fetchImpl: typeof fetch = fetch) {
	return cachedOptional(
		`manifest:${repo}`,
		async () =>
			parseRegistryManifest(await fetchJson(releaseAssetUrl(repo, "manifest.json"), fetchImpl)) ??
			parseRegistryManifest(await fetchJson(rawFileUrl(repo, "manifest.json"), fetchImpl)),
	)
}

function fetchPalette(
	repo: string,
	fileName: string,
	label: ThemePalette["label"],
	fetchImpl: typeof fetch,
) {
	return cachedOptional(`palette:${repo}/${fileName}`, async () => {
		const css =
			(await fetchText(releaseAssetUrl(repo, fileName), fetchImpl)) ??
			(await fetchText(rawFileUrl(repo, fileName), fetchImpl))
		return css ? parseThemePalette(css, label) : null
	})
}

async function fetchThemePalettes(
	repo: string,
	manifest: RegistryManifest | null,
	fetchImpl: typeof fetch,
) {
	if (!manifest) return []
	const entries = [
		["Dark", manifest.colorschemes.dark],
		["Light", manifest.colorschemes.light],
	] as const
	const palettes = await Promise.all(
		entries.map(([label, file]) => (file ? fetchPalette(repo, file, label, fetchImpl) : null)),
	)
	return palettes.filter((palette): palette is ThemePalette => palette !== null)
}

async function toMarketplaceItem(
	kind: "plugins" | "themes",
	entry: RegistryEntry,
	stats: RegistryStats | null,
	verified: readonly VerifiedEntry[],
	fetchImpl: typeof fetch,
): Promise<MarketplaceItem> {
	const itemStats = getItemStats(stats, kind, entry.id)
	const manifest = await fetchManifest(entry.repo, fetchImpl)
	const palettes =
		kind === "themes" ? await fetchThemePalettes(entry.repo, manifest, fetchImpl) : []

	return {
		kind,
		id: entry.id,
		name: kind === "themes" ? (manifest?.displayName ?? entry.name) : entry.name,
		author: entry.author,
		authorUrl: entry.authorUrl ?? null,
		description: entry.description,
		repo: entry.repo,
		coverImageUrl: entry.coverImageUrl || null,
		screenshots: entry.screenshots,
		iconNode: kind === "plugins" ? await resolveIconNode(manifest?.icon) : null,
		verified: isVerifiedEntry(verified, kind === "plugins" ? "plugin" : "theme", entry.id),
		votes: itemStats?.votes ?? 0,
		downloads: itemStats?.downloads ?? 0,
		version: itemStats?.latest ?? manifest?.version ?? null,
		minAppVersion: manifest?.minAppVersion ?? null,
		releasedAt: itemStats?.releasedAt ?? null,
		discussionUrl: itemStats?.discussion?.url ?? null,
		discussionNumber: itemStats?.discussion?.number ?? null,
		capabilities: kind === "plugins" ? (manifest?.capabilities ?? null) : null,
		palettes,
		appearance:
			palettes.length > 1
				? "Light and dark"
				: palettes.length === 1
					? (palettes[0]?.label ?? null)
					: null,
	}
}

function visibleEntries(
	entries: RegistryEntry[],
	blocked: readonly BlockedEntry[],
	kind: "plugin" | "theme",
) {
	return entries.filter((entry) => findBlockedEntry(blocked, kind, entry.id)?.versions !== null)
}

export async function fetchMarketplaceCatalog(
	fetchImpl: typeof fetch = fetch,
): Promise<MarketplaceCatalog> {
	const repo = getRegistryRepo()
	const [pluginsJson, themesJson, statsJson, verifiedJson, blockedJson] = await Promise.all([
		fetchJson(registryFileUrl(repo, "main", "plugins.json"), fetchImpl),
		fetchJson(registryFileUrl(repo, "main", "themes.json"), fetchImpl),
		fetchJson(registryFileUrl(repo, "data", "stats.json"), fetchImpl),
		fetchJson(registryFileUrl(repo, "main", "verified.json"), fetchImpl),
		fetchJson(registryFileUrl(repo, "main", "blocked.json"), fetchImpl),
	])

	const plugins = parseRegistryEntries(pluginsJson)
	const themes = parseRegistryEntries(themesJson)
	const blocked = parseBlockedEntries(blockedJson)

	if (!plugins || !themes || !blocked) {
		return { status: "unavailable", items: [], generatedAt: null, isStale: false }
	}

	const stats = parseRegistryStats(statsJson)
	const verified = parseVerifiedEntries(verifiedJson) ?? []
	const items = await Promise.all([
		...visibleEntries(plugins, blocked, "plugin").map((entry) =>
			toMarketplaceItem("plugins", entry, stats, verified, fetchImpl),
		),
		...visibleEntries(themes, blocked, "theme").map((entry) =>
			toMarketplaceItem("themes", entry, stats, verified, fetchImpl),
		),
	])

	return {
		status: "ok",
		items,
		generatedAt: stats?.generatedAt ?? null,
		isStale: false,
	}
}

export async function fetchCachedMarketplaceCatalog(): Promise<MarketplaceCatalog> {
	const cached = await withCache({
		key: "marketplace:catalog",
		ttlSeconds: CATALOG_CACHE_SECONDS,
		tags: ["marketplace"],
		load: async () => {
			const catalog = await fetchMarketplaceCatalog()
			return catalog.status === "unavailable" ? null : catalog
		},
	})
	if (!cached) return { status: "unavailable", items: [], generatedAt: null, isStale: false }
	return cached.isStale ? { ...cached.value, isStale: true } : cached.value
}

export type MarketplaceItemResult =
	| { status: "ok"; item: MarketplaceItem; isStale: boolean }
	| { status: "notFound" }
	| { status: "unavailable" }
