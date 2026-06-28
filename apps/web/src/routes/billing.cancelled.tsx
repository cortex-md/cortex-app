import { createFileRoute } from "@tanstack/react-router"
import { siteConfig } from "../config/site"
import { BillingCancelledPage } from "../features/billing/BillingCancelledPage"
import { createSeoHead, noIndexRobots } from "../seo/metadata"

const billingCancelledDescription =
	"Your Cortex Sync checkout was cancelled and your plan was not changed."

export const Route = createFileRoute("/billing/cancelled")({
	head: () =>
		createSeoHead({
			title: `Checkout cancelled — ${siteConfig.name}`,
			description: billingCancelledDescription,
			path: "/billing/cancelled",
			robots: noIndexRobots,
		}),
	component: BillingCancelledPage,
})
