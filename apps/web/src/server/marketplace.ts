import {
	type BlockedEntry,
	findBlockedEntry,
	getItemStats,
	isVerifiedEntry,
	type MarketplaceItemStats,
	type MarketplaceStats,
	parseBlockedEntries,
	parseMarketplaceStats,
	parseVerifiedEntries,
	type RegistryEntry,
	registryFileUrl,
	type VerifiedEntry,
} from "@cortex/marketplace/catalog"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { renderReleaseMarkdown } from "./changelog"

const CACHE_TTL_MS = 5 * 60 * 1000
const USER_AGENT = "Cortex website marketplace"

export type MarketplaceKindParam = "plugins" | "themes"

export interface MarketplaceCatalogItem {
	kind: MarketplaceKindParam
	entry: RegistryEntry
	stats: MarketplaceItemStats | null
	verified: boolean
	pulledVersions: string[]
	pulledReason: string | null
}

export interface MarketplaceCatalog {
	status: "ok" | "unavailable"
	plugins: MarketplaceCatalogItem[]
	themes: MarketplaceCatalogItem[]
	generatedAt: string | null
	isStale: boolean
}

export interface MarketplaceItemPage {
	item: MarketplaceCatalogItem
	readmeHtml: string | null
	generatedAt: string | null
}

interface CachedValue<Value> {
	value: Value
	expiresAt: number
}

let cachedCatalog: CachedValue<MarketplaceCatalog> | undefined
const cachedReadmes = new Map<string, CachedValue<string | null>>()

globalThis.__CORTEX_REGISTRY_REPO__ ??= process.env.CORTEX_REGISTRY_REPO || undefined

async function fetchJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
	try {
		const response = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT } })
		if (!response.ok) return null
		return await response.json()
	} catch {
		return null
	}
}

function toCatalogItems(
	kind: MarketplaceKindParam,
	entries: RegistryEntry[],
	stats: MarketplaceStats | null,
	verified: VerifiedEntry[],
	blocked: BlockedEntry[],
): MarketplaceCatalogItem[] {
	const blockKind = kind === "plugins" ? "plugin" : "theme"
	return entries.flatMap((entry) => {
		const block = findBlockedEntry(blocked, blockKind, entry.id)
		if (block?.versions === null) return []
		return [
			{
				kind,
				entry,
				stats: getItemStats(stats, kind, entry.id),
				verified: isVerifiedEntry(verified, kind, entry.id),
				pulledVersions: block?.versions ?? [],
				pulledReason: block?.reason ?? null,
			},
		]
	})
}

export async function fetchMarketplaceCatalog(
	fetchImpl: typeof fetch = fetch,
): Promise<MarketplaceCatalog> {
	const [plugins, themes, stats, verified, blocked] = await Promise.all([
		fetchJson(registryFileUrl("main", "plugins.json"), fetchImpl),
		fetchJson(registryFileUrl("main", "themes.json"), fetchImpl),
		fetchJson(registryFileUrl("data", "stats.json"), fetchImpl),
		fetchJson(registryFileUrl("main", "verified.json"), fetchImpl),
		fetchJson(registryFileUrl("main", "blocked.json"), fetchImpl),
	])

	if (!Array.isArray(plugins) || !Array.isArray(themes)) {
		return { status: "unavailable", plugins: [], themes: [], generatedAt: null, isStale: false }
	}

	const parsedStats = parseMarketplaceStats(stats)
	const parsedVerified = parseVerifiedEntries(verified) ?? []
	const parsedBlocked = parseBlockedEntries(blocked) ?? []

	return {
		status: "ok",
		plugins: toCatalogItems(
			"plugins",
			plugins as RegistryEntry[],
			parsedStats,
			parsedVerified,
			parsedBlocked,
		),
		themes: toCatalogItems(
			"themes",
			themes as RegistryEntry[],
			parsedStats,
			parsedVerified,
			parsedBlocked,
		),
		generatedAt: parsedStats?.generatedAt ?? null,
		isStale: false,
	}
}

async function fetchCachedCatalog(): Promise<MarketplaceCatalog> {
	const now = Date.now()
	if (cachedCatalog && cachedCatalog.expiresAt > now) return cachedCatalog.value

	const next = await fetchMarketplaceCatalog()
	if (next.status === "unavailable" && cachedCatalog) {
		return { ...cachedCatalog.value, isStale: true }
	}
	cachedCatalog = { value: next, expiresAt: now + CACHE_TTL_MS }
	return next
}

async function fetchReadmeHtml(repo: string): Promise<string | null> {
	const now = Date.now()
	const cached = cachedReadmes.get(repo)
	if (cached && cached.expiresAt > now) return cached.value

	let html: string | null = null
	for (const branch of ["main", "master"]) {
		try {
			const response = await fetch(
				`https://raw.githubusercontent.com/${repo}/${branch}/README.md`,
				{
					headers: { "User-Agent": USER_AGENT },
				},
			)
			if (!response.ok) continue
			html = await renderReleaseMarkdown(await response.text())
			break
		} catch {}
	}

	if (html === null && cached) return cached.value
	cachedReadmes.set(repo, { value: html, expiresAt: now + CACHE_TTL_MS })
	return html
}

export const getMarketplaceCatalog = createServerFn({ method: "GET" }).handler(() =>
	fetchCachedCatalog(),
)

const itemInputSchema = z.object({
	kind: z.enum(["plugins", "themes"]),
	id: z.string().min(1).max(100),
})

export const getMarketplaceItem = createServerFn({ method: "GET" })
	.validator(itemInputSchema)
	.handler(async ({ data }): Promise<MarketplaceItemPage | null> => {
		const catalog = await fetchCachedCatalog()
		const item = catalog[data.kind].find((candidate) => candidate.entry.id === data.id)
		if (!item) return null
		return {
			item,
			readmeHtml: await fetchReadmeHtml(item.entry.repo),
			generatedAt: catalog.generatedAt,
		}
	})
