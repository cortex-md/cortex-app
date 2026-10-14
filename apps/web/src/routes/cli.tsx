import { createFileRoute } from "@tanstack/react-router"
import { cliPage } from "../content/product"
import { CliPage } from "../features/product/cli/CliPage"
import { createProductHead } from "../features/product/productHead"

export const Route = createFileRoute("/cli")({
	head: () =>
		createProductHead({
			seo: cliPage.seo,
			name: "Cortex CLI",
			operatingSystem: "macOS, Windows, Linux",
			applicationCategory: "DeveloperApplication",
			featureList: cliPage.steps.map((step) => step.title),
			price: "0",
		}),
	component: CliPage,
})
