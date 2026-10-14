import { createFileRoute } from "@tanstack/react-router"
import { syncPage } from "../content/product"
import { createProductHead } from "../features/product/productHead"
import { SyncPage } from "../features/product/sync/SyncPage"

export const Route = createFileRoute("/sync")({
	head: () =>
		createProductHead({
			seo: syncPage.seo,
			name: "Cortex Sync",
			applicationCategory: "ProductivityApplication",
			featureList: syncPage.pricing.plan.features,
			price: syncPage.pricing.plan.price,
			isService: true,
		}),
	component: SyncPage,
})
