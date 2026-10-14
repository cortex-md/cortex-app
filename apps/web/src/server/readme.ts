import { prepareReadmeMarkdown } from "../lib/registry/readme"
import { withCache } from "./cache"
import { renderReleaseMarkdown } from "./changelog"

export const README_CACHE_SECONDS = 600
const USER_AGENT = "Cortex website marketplace"

export interface MarketplaceReadme {
	html: string
}

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
	const cached = await withCache<MarketplaceReadme | null>({
		key: `readme:${repo}`,
		ttlSeconds: README_CACHE_SECONDS,
		tags: ["marketplace", `readme:${repo}`],
		load: async () => {
			const readme = await fetchReadme(repo)
			return readme === undefined ? null : { html: readme?.html ?? "" }
		},
	})
	return cached?.value?.html ? cached.value : null
}
