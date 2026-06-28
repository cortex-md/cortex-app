import { createFileRoute } from "@tanstack/react-router"
import { siteConfig } from "../config/site"
import { BillingPage } from "../features/billing/BillingPage"
import { createSeoHead, noIndexRobots } from "../seo/metadata"

const billingDescription =
	"Start a hosted Cortex Sync checkout through AbacatePay while keeping self-hosting available."

export const Route = createFileRoute("/billing")({
	head: () =>
		createSeoHead({
			title: `Billing — ${siteConfig.name}`,
			description: billingDescription,
			path: "/billing",
			robots: noIndexRobots,
		}),
	component: BillingPage,
})
