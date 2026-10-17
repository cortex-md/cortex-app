import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { marketplacePage } from "../content/product"
import { MarketplaceProductPage } from "../features/product/marketplace/MarketplaceProductPage"
import { createProductHead } from "../features/product/productHead"

const legacySearchSchema = z.object({
	tab: z.enum(["plugins", "themes"]).optional().catch(undefined),
})

export const Route = createFileRoute("/marketplace/")({
	validateSearch: (search) => legacySearchSchema.parse(search),
	beforeLoad: ({ search }) => {
		if (search.tab) {
			throw redirect({ href: `/marketplace/browse?kind=${search.tab}`, statusCode: 301 })
		}
	},
	head: () =>
		createProductHead({
			seo: marketplacePage.seo,
			name: "Cortex Marketplace",
			featureList: ["Plugins", "Themes"],
			isService: true,
		}),
	component: MarketplaceProductPage,
})
