import type {
	MarketplaceKind,
	MarketplaceKindFilter,
	MarketplaceSort,
} from "../../content/marketplace"
import type { MarketplaceItem } from "../../server/marketplace"

const countFormatter = new Intl.NumberFormat("en", {
	notation: "compact",
	maximumFractionDigits: 1,
})
const dateFormatter = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
})

export const marketplaceKinds: MarketplaceKind[] = ["plugins", "themes"]

export function formatCount(value: number) {
	return countFormatter.format(value)
}

export function formatDate(value: string | null) {
	if (!value) return null
	const time = Date.parse(value)
	return Number.isNaN(time) ? null : dateFormatter.format(time)
}

export function getItemHref(item: Pick<MarketplaceItem, "kind" | "id">) {
	return `/marketplace/${item.kind}/${encodeURIComponent(item.id)}`
}

export function matchesQuery(item: MarketplaceItem, query: string) {
	const normalized = query.trim().toLowerCase()
	if (!normalized) return true
	return `${item.name} ${item.description} ${item.author} ${item.repo}`
		.toLowerCase()
		.includes(normalized)
}

function sortValue(item: MarketplaceItem, sort: MarketplaceSort) {
	if (sort === "downloads") return item.downloads
	if (sort === "updated") return item.releasedAt ? Date.parse(item.releasedAt) : -1
	return item.votes
}

export function sortItems(items: MarketplaceItem[], sort: MarketplaceSort) {
	return [...items].sort((a, b) => {
		const difference = sortValue(b, sort) - sortValue(a, sort)
		return difference !== 0 ? difference : a.name.localeCompare(b.name)
	})
}

export function countByKind(items: MarketplaceItem[], query: string) {
	const matching = items.filter((item) => matchesQuery(item, query))
	return {
		all: matching.length,
		plugins: matching.filter((item) => item.kind === "plugins").length,
		themes: matching.filter((item) => item.kind === "themes").length,
	} satisfies Record<MarketplaceKindFilter, number>
}
