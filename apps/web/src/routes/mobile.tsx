import { createFileRoute } from "@tanstack/react-router"
import { mobilePage } from "../content/product"
import { MobilePage } from "../features/product/mobile/MobilePage"
import { createProductHead } from "../features/product/productHead"

export const Route = createFileRoute("/mobile")({
	head: () =>
		createProductHead({
			seo: mobilePage.seo,
			name: "Cortex for iOS and Android",
			operatingSystem: "iOS, Android",
			featureList: mobilePage.stories.flatMap((story) => story.points),
		}),
	component: MobilePage,
})
