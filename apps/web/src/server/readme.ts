import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { prepareReadmeMarkdown } from "../lib/registry/readme"
import { renderReleaseMarkdown } from "./changelog"
import { fetchCachedMarketplaceCatalog } from "./marketplace"

const CACHE_TTL_MS = 10 * 60 * 1000
const USER_AGENT = "Cortex website marketplace"

export interface MarketplaceReadme {
	html: string
}

const cachedReadmes = new Map<string, { expiresAt: number; value: MarketplaceReadme | null }>()

export async function fetchReadme(
	repo: string,
	fetcher: typeof fetch = fetch,
): Promise<MarketplaceReadme | null | undefined> {
	try {
		const response = await fetcher(`https://raw.githubusercontent.com/${repo}/HEAD/README.md`, {
			headers: { "User-Agent": USER_AGENT },
			signal: AbortSignal.timeout(8000),
		})
		if (response.status === 404) return null
		if (!response.ok) return undefined
		const markdown = (await response.text()).trim()
		if (!markdown) return null
		return { html: await renderReleaseMarkdown(prepareReadmeMarkdown(markdown, repo)) }
	} catch {
		return undefined
	}
}

export async function fetchCachedReadme(repo: string) {
	const now = Date.now()
	const cached = cachedReadmes.get(repo)
	if (cached && cached.expiresAt > now) return cached.value

	const next = await fetchReadme(repo)
	if (next === undefined) return cached?.value ?? null

	cachedReadmes.set(repo, { value: next, expiresAt: now + CACHE_TTL_MS })
	return next
}

export const getMarketplaceReadme = createServerFn({ method: "GET" })
	.validator(z.object({ kind: z.enum(["plugins", "themes"]), id: z.string().min(1).max(100) }))
	.handler(async ({ data }) => {
		const catalog = await fetchCachedMarketplaceCatalog()
		const item = catalog.items.find(
			(candidate) => candidate.kind === data.kind && candidate.id === data.id,
		)
		return item ? fetchCachedReadme(item.repo) : null
	})
