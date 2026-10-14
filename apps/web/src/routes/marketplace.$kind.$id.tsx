import { createFileRoute, notFound } from "@tanstack/react-router"
import { siteConfig } from "../config/site"
import docsCss from "../features/docs/docs.css?url"
import { MarketplaceItemPage } from "../features/marketplace/MarketplaceItemPage"
import { createSeoHead } from "../seo/metadata"

export const Route = createFileRoute("/marketplace/$kind/$id")({
	loader: async ({ params }) => {
		if (params.kind !== "plugins" && params.kind !== "themes") throw notFound()
		const { getMarketplaceItem } = await import("../server/marketplace")
		const page = await getMarketplaceItem({ data: { kind: params.kind, id: params.id } })
		if (!page) throw notFound()
		return { page }
	},
	head: ({ loaderData, params }) => {
		const seoHead = createSeoHead({
			title: `${loaderData?.page.item.entry.name ?? "Marketplace"} — ${siteConfig.name}`,
			description: loaderData?.page.item.entry.description ?? siteConfig.description,
			path: `/marketplace/${params.kind}/${params.id}`,
		})
		return { ...seoHead, links: [...seoHead.links, { rel: "stylesheet", href: docsCss }] }
	},
	component: MarketplaceItemRoute,
})

function MarketplaceItemRoute() {
	const { page } = Route.useLoaderData()
	return <MarketplaceItemPage page={page} />
}
