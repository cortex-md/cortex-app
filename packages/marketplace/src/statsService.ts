import { getPlatform } from "@cortex/platform"
import {
	createEmptyStats,
	parseBlockedEntries,
	parseMarketplaceStats,
	parseVerifiedEntries,
} from "./catalogData"
import { registryFileUrl } from "./registryConfig"
import type { BlockedEntry, MarketplaceStats, VerifiedEntry } from "./types"

const CACHE_TTL_MS = 10 * 60 * 1000

interface CacheSlot<Value> {
	value: Value
	fetchedAt: number
}

let statsCache: CacheSlot<MarketplaceStats> | null = null
let verifiedCache: CacheSlot<VerifiedEntry[]> | null = null
let blockedCache: CacheSlot<BlockedEntry[]> | null = null

export async function fetchMarketplaceStats(): Promise<MarketplaceStats> {
	const cached = statsCache
	if (cached && isFresh(cached)) return cached.value
	const parsed = parseMarketplaceStats(await fetchJson(registryFileUrl("data", "stats.json")))
	if (!parsed) return cached?.value ?? createEmptyStats()
	statsCache = { value: parsed, fetchedAt: Date.now() }
	return parsed
}

export async function fetchVerifiedEntries(): Promise<VerifiedEntry[]> {
	const cached = verifiedCache
	if (cached && isFresh(cached)) return cached.value
	const parsed = parseVerifiedEntries(await fetchJson(registryFileUrl("main", "verified.json")))
	if (!parsed) return cached?.value ?? []
	verifiedCache = { value: parsed, fetchedAt: Date.now() }
	return parsed
}

export async function fetchBlockedEntries(): Promise<BlockedEntry[] | null> {
	const cached = blockedCache
	if (cached && isFresh(cached)) return cached.value
	const parsed = parseBlockedEntries(await fetchJson(registryFileUrl("main", "blocked.json")))
	if (!parsed) return cached?.value ?? null
	blockedCache = { value: parsed, fetchedAt: Date.now() }
	return parsed
}

export function invalidateStatsCache(): void {
	statsCache = null
	verifiedCache = null
	blockedCache = null
}

async function fetchJson(url: string): Promise<unknown> {
	try {
		const response = await getPlatform().http.fetch(url)
		if (!response.ok) return null
		return await response.json()
	} catch {
		return null
	}
}

function isFresh<Value>(slot: CacheSlot<Value>): boolean {
	return Date.now() - slot.fetchedAt < CACHE_TTL_MS
}
