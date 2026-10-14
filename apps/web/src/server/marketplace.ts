import { createServerFn } from "@tanstack/react-start"
import type { IconNode } from "lucide-react"
import { dynamicIconImports } from "lucide-react/dynamic"
import { z } from "zod"
import {
	builtInPlugins,
	builtInTemplates,
	builtInThemePalettes,
	builtInThemes,
	cortexAppRepo,
	type MarketplaceKind,
	type TemplateArt,
} from "../content/marketplace"
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

const CATALOG_TTL_MS = 5 * 60 * 1000
const MANIFEST_TTL_MS = 30 * 60 * 1000
const USER_AGENT = "Cortex website marketplace"

export interface MarketplaceTemplateData {
	properties: ReadonlyArray<{ name: string; type: string }>
	views: string[]
	art: TemplateArt
	columnLabel: string
	columns: ReadonlyArray<{ title: string; cards: string[] }>
	rows: ReadonlyArray<{ title: string; value: string }>
}

export interface MarketplaceItem {
	kind: MarketplaceKind
	id: string
	name: string
	author: string
	authorUrl: string | null
	description: string
	source: "community" | "builtin"
	repo: string
	coverImageUrl: string | null
	iconNode: IconNode | null
	verified: boolean
	votes: number | null
	downloads: number | null
	version: string | null
	minAppVersion: string | null
	releasedAt: string | null
	discussionUrl: string | null
	capabilities: string[] | null
	palettes: ThemePalette[]
	appearance: string | null
	template: MarketplaceTemplateData | null
}

export interface MarketplaceCatalog {
	status: "ok" | "unavailable"
	items: MarketplaceItem[]
	generatedAt: string | null
	isStale: boolean
}

interface CachedValue<Value> {
	value: Value
	expiresAt: number
}

let cachedCatalog: CachedValue<MarketplaceCatalog> | undefined
const cachedManifests = new Map<string, CachedValue<RegistryManifest | null>>()
const cachedPalettes = new Map<string, CachedValue<ThemePalette | null>>()

function getRegistryRepo() {
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

async function withCache<Value>(
	cache: Map<string, CachedValue<Value>>,
	key: string,
	load: () => Promise<Value>,
	isEmpty: (value: Value) => boolean,
) {
	const now = Date.now()
	const cached = cache.get(key)
	if (cached && cached.expiresAt > now) return cached.value
	const value = await load()
	if (isEmpty(value) && cached) return cached.value
	cache.set(key, { value, expiresAt: now + MANIFEST_TTL_MS })
	return value
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
	return withCache(
		cachedManifests,
		repo,
		async () =>
			parseRegistryManifest(await fetchJson(releaseAssetUrl(repo, "manifest.json"), fetchImpl)) ??
			parseRegistryManifest(await fetchJson(rawFileUrl(repo, "manifest.json"), fetchImpl)),
		(value) => value === null,
	)
}

function fetchPalette(
	repo: string,
	fileName: string,
	label: ThemePalette["label"],
	fetchImpl: typeof fetch,
) {
	return withCache(
		cachedPalettes,
		`${repo}/${fileName}`,
		async () => {
			const css =
				(await fetchText(releaseAssetUrl(repo, fileName), fetchImpl)) ??
				(await fetchText(rawFileUrl(repo, fileName), fetchImpl))
			return css ? parseThemePalette(css, label) : null
		},
		(value) => value === null,
	)
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

async function toCommunityItem(
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
		source: "community",
		repo: entry.repo,
		coverImageUrl: entry.coverImageUrl || null,
		iconNode: kind === "plugins" ? await resolveIconNode(manifest?.icon) : null,
		verified: isVerifiedEntry(verified, kind === "plugins" ? "plugin" : "theme", entry.id),
		votes: itemStats?.votes ?? 0,
		downloads: itemStats?.downloads ?? 0,
		version: itemStats?.latest ?? manifest?.version ?? null,
		minAppVersion: manifest?.minAppVersion ?? null,
		releasedAt: itemStats?.releasedAt ?? null,
		discussionUrl: itemStats?.discussion?.url ?? null,
		capabilities: kind === "plugins" ? (manifest?.capabilities ?? null) : null,
		palettes,
		appearance:
			palettes.length > 1
				? "Light and dark"
				: palettes.length === 1
					? (palettes[0]?.label ?? null)
					: null,
		template: null,
	}
}

async function builtInItems(): Promise<MarketplaceItem[]> {
	const pluginIcons = await Promise.all(
		builtInPlugins.map((plugin) => resolveIconNode(plugin.icon)),
	)
	const base = {
		authorUrl: null,
		source: "builtin" as const,
		repo: cortexAppRepo,
		coverImageUrl: null,
		verified: false,
		votes: null,
		downloads: null,
		releasedAt: null,
		discussionUrl: null,
	}

	return [
		...builtInPlugins.map(
			(plugin, index): MarketplaceItem => ({
				...base,
				kind: "plugins",
				id: plugin.id,
				name: plugin.name,
				author: plugin.author,
				description: plugin.description,
				iconNode: pluginIcons[index] ?? null,
				version: plugin.version,
				minAppVersion: plugin.minAppVersion,
				capabilities: plugin.capabilities,
				palettes: [],
				appearance: null,
				template: null,
			}),
		),
		...builtInThemes.map(
			(theme): MarketplaceItem => ({
				...base,
				kind: "themes",
				id: theme.id,
				name: theme.name,
				author: theme.author,
				description: theme.description,
				iconNode: null,
				version: null,
				minAppVersion: null,
				capabilities: null,
				palettes: [builtInThemePalettes[theme.id]],
				appearance: theme.appearance,
				template: null,
			}),
		),
		...builtInTemplates.map(
			(template): MarketplaceItem => ({
				...base,
				kind: "templates",
				id: template.id,
				name: template.name,
				author: template.author,
				description: template.description,
				iconNode: null,
				version: null,
				minAppVersion: null,
				capabilities: null,
				palettes: [],
				appearance: null,
				template: {
					properties: template.properties,
					views: template.views,
					art: template.art,
					columnLabel: template.columnLabel,
					columns: template.columns,
					rows: template.rows,
				},
			}),
		),
	]
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
	const community = await Promise.all([
		...visibleEntries(plugins, blocked, "plugin").map((entry) =>
			toCommunityItem("plugins", entry, stats, verified, fetchImpl),
		),
		...visibleEntries(themes, blocked, "theme").map((entry) =>
			toCommunityItem("themes", entry, stats, verified, fetchImpl),
		),
	])
	const communityKeys = new Set(community.map((item) => `${item.kind}/${item.id}`))

	return {
		status: "ok",
		items: [
			...community,
			...(await builtInItems()).filter((item) => !communityKeys.has(`${item.kind}/${item.id}`)),
		],
		generatedAt: stats?.generatedAt ?? null,
		isStale: false,
	}
}

export async function fetchCachedMarketplaceCatalog(): Promise<MarketplaceCatalog> {
	const now = Date.now()
	if (cachedCatalog && cachedCatalog.expiresAt > now) return cachedCatalog.value

	const next = await fetchMarketplaceCatalog()
	if (next.status === "unavailable") {
		return cachedCatalog ? { ...cachedCatalog.value, isStale: true } : next
	}
	cachedCatalog = { value: next, expiresAt: now + CATALOG_TTL_MS }
	return next
}

export const getMarketplaceCatalog = createServerFn({ method: "GET" }).handler(() =>
	fetchCachedMarketplaceCatalog(),
)

const itemInputSchema = z.object({
	kind: z.enum(["plugins", "themes", "templates"]),
	id: z.string().min(1).max(100),
})

export type MarketplaceItemResult =
	| { status: "ok"; item: MarketplaceItem; isStale: boolean }
	| { status: "notFound" }
	| { status: "unavailable" }

export const getMarketplaceItem = createServerFn({ method: "GET" })
	.validator(itemInputSchema)
	.handler(async ({ data }): Promise<MarketplaceItemResult> => {
		const catalog = await fetchCachedMarketplaceCatalog()
		if (catalog.status === "unavailable") {
			const builtIn = (await builtInItems()).find(
				(item) => item.kind === data.kind && item.id === data.id,
			)
			return builtIn ? { status: "ok", item: builtIn, isStale: true } : { status: "unavailable" }
		}
		const item = catalog.items.find(
			(candidate) => candidate.kind === data.kind && candidate.id === data.id,
		)
		return item ? { status: "ok", item, isStale: catalog.isStale } : { status: "notFound" }
	})
