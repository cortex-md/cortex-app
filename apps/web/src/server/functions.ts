import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { MarketplaceItemResult } from "./marketplace"

const marketplaceItemInput = z.object({
	kind: z.enum(["plugins", "themes"]),
	id: z.string().min(1).max(100),
})

async function cacheResponseFor(seconds: number) {
	const { cacheServerFnResponse } = await import("./cache.server")
	cacheServerFnResponse(seconds)
}

export const getChangelogReleases = createServerFn({ method: "GET" }).handler(async () => {
	const { CHANGELOG_CACHE_SECONDS, fetchCachedChangelogReleases } = await import("./changelog")
	const result = await fetchCachedChangelogReleases()
	if (result.status !== "unavailable" && !result.isStale) {
		await cacheResponseFor(CHANGELOG_CACHE_SECONDS)
	}
	return result
})

export const getRoadmapItems = createServerFn({ method: "GET" }).handler(async () => {
	const { ROADMAP_CACHE_SECONDS, fetchCachedRoadmapItems } = await import("./roadmap")
	const result = await fetchCachedRoadmapItems()
	if (result.status !== "unavailable" && !result.isStale) {
		await cacheResponseFor(ROADMAP_CACHE_SECONDS)
	}
	return result
})

export const getMarketplaceCatalog = createServerFn({ method: "GET" }).handler(async () => {
	const { CATALOG_CACHE_SECONDS, fetchCachedMarketplaceCatalog } = await import("./marketplace")
	const catalog = await fetchCachedMarketplaceCatalog()
	if (catalog.status === "ok" && !catalog.isStale) await cacheResponseFor(CATALOG_CACHE_SECONDS)
	return catalog
})

export const getMarketplaceItem = createServerFn({ method: "GET" })
	.validator(marketplaceItemInput)
	.handler(async ({ data }): Promise<MarketplaceItemResult> => {
		const { CATALOG_CACHE_SECONDS, fetchCachedMarketplaceCatalog } = await import("./marketplace")
		const catalog = await fetchCachedMarketplaceCatalog()
		if (catalog.status === "unavailable") return { status: "unavailable" }
		const item = catalog.items.find(
			(candidate) => candidate.kind === data.kind && candidate.id === data.id,
		)
		if (!item) return { status: "notFound" }
		if (!catalog.isStale) await cacheResponseFor(CATALOG_CACHE_SECONDS)
		return { status: "ok", item, isStale: catalog.isStale }
	})

export const getMarketplaceReadme = createServerFn({ method: "GET" })
	.validator(marketplaceItemInput)
	.handler(async ({ data }) => {
		const { fetchCachedMarketplaceCatalog } = await import("./marketplace")
		const { README_CACHE_SECONDS, fetchCachedReadme } = await import("./readme")
		const catalog = await fetchCachedMarketplaceCatalog()
		const item = catalog.items.find(
			(candidate) => candidate.kind === data.kind && candidate.id === data.id,
		)
		const readme = item ? await fetchCachedReadme(item.repo) : null
		if (readme) await cacheResponseFor(README_CACHE_SECONDS)
		return readme
	})

export const getDiscussionComments = createServerFn({ method: "GET" })
	.validator(z.object({ number: z.number().int().positive() }))
	.handler(async ({ data }) => {
		const { getRegistryRepo } = await import("./marketplace")
		const { DISCUSSION_CACHE_SECONDS, fetchCachedDiscussionComments } = await import(
			"./discussions"
		)
		const result = await fetchCachedDiscussionComments(getRegistryRepo(), data.number)
		if (result.status === "ok") await cacheResponseFor(DISCUSSION_CACHE_SECONDS)
		return result
	})
