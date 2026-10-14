import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { siteConfig } from "../config/site"
import { MarketplacePage } from "../features/marketplace/MarketplacePage"
import { createSeoHead } from "../seo/metadata"

const searchSchema = z.object({
	tab: z.enum(["plugins", "themes"]).catch("plugins"),
	sort: z.enum(["popular", "downloads", "name"]).catch("popular"),
})

export const Route = createFileRoute("/marketplace/")({
	validateSearch: (search) => searchSchema.parse(search),
	loader: async () => {
		const { getMarketplaceCatalog } = await import("../server/marketplace")
		return { catalog: await getMarketplaceCatalog() }
	},
	head: () =>
		createSeoHead({
			title: `Marketplace — ${siteConfig.name}`,
			description: "Community plugins and themes for Cortex, ranked by votes and downloads.",
			path: "/marketplace",
		}),
	component: MarketplaceRoute,
})

function MarketplaceRoute() {
	const { catalog } = Route.useLoaderData()
	const { tab, sort } = Route.useSearch()
	return <MarketplacePage catalog={catalog} sort={sort} tab={tab} />
}
