import { createFileRoute, notFound } from "@tanstack/react-router"
import { marketplaceKindLabels } from "../content/marketplace"
import { MarketplaceUnavailable } from "../features/marketplace/MarketplaceBits"
import { MarketplaceDetailPage } from "../features/marketplace/MarketplaceDetailPage"
import { getItemHref } from "../features/marketplace/marketplaceModel"
import { createSeoHead, noIndexRobots, pageTitle } from "../seo/metadata"
import { breadcrumbSchema, jsonLdScripts, softwareApplicationSchema } from "../seo/structuredData"
import { getMarketplaceItem } from "../server/marketplace"

const kinds = new Set(["plugins", "themes", "templates"])

export const Route = createFileRoute("/marketplace/$kind/$id")({
	loader: async ({ params }) => {
		if (!kinds.has(params.kind)) throw notFound()
		const result = await getMarketplaceItem({
			data: { kind: params.kind as "plugins" | "themes" | "templates", id: params.id },
		})
		if (result.status === "notFound") throw notFound()
		return { result }
	},
	staleTime: 60_000,
	headers: ({ loaderData }) => ({
		"Cache-Control":
			loaderData?.result.status === "ok" && !loaderData.result.isStale
				? "public, s-maxage=300, stale-while-revalidate=86400"
				: "no-store",
	}),
	head: ({ loaderData, params }) => {
		const path = `/marketplace/${params.kind}/${params.id}`
		const result = loaderData?.result
		if (!result || result.status !== "ok") {
			return createSeoHead({ title: pageTitle("Marketplace"), path, robots: noIndexRobots })
		}
		const { item } = result
		const kindLabel = marketplaceKindLabels[item.kind]
		const description = item.description || `${kindLabel.singular} for Cortex by ${item.author}.`
		return {
			...createSeoHead({
				title: pageTitle(`${item.name} · ${kindLabel.singular}`),
				description,
				path: getItemHref(item),
				...(item.coverImageUrl
					? { image: item.coverImageUrl, imageAlt: `${item.name} cover` }
					: {}),
			}),
			scripts: jsonLdScripts(
				softwareApplicationSchema({
					name: item.name,
					description,
					path: getItemHref(item),
					applicationCategory: "ProductivityApplication",
					author: { name: item.author, ...(item.authorUrl ? { url: item.authorUrl } : {}) },
					...(item.version ? { softwareVersion: item.version } : {}),
					...(item.releasedAt ? { dateModified: item.releasedAt } : {}),
					...(item.coverImageUrl ? { image: item.coverImageUrl } : {}),
					isPartOf: true,
				}),
				breadcrumbSchema([
					{ name: "Marketplace", path: "/marketplace" },
					{ name: kindLabel.plural, path: `/marketplace/browse?kind=${item.kind}` },
					{ name: item.name, path: getItemHref(item) },
				]),
			),
		}
	},
	component: MarketplaceItemRoute,
})

function MarketplaceItemRoute() {
	const { result } = Route.useLoaderData()

	if (result.status !== "ok") {
		return (
			<div className="mx-auto w-[min(1180px,calc(100%-64px))] pt-16 max-sm:w-[calc(100%-40px)]">
				<MarketplaceUnavailable />
			</div>
		)
	}

	return <MarketplaceDetailPage item={result.item} isStale={result.isStale} />
}
