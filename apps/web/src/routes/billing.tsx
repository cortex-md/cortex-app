import { createFileRoute } from "@tanstack/react-router"
import { billingCopy } from "../content/callback"
import { BillingPage } from "../features/billing/BillingPage"
import { createPrivateSeoHead, pageTitle } from "../seo/metadata"

export const Route = createFileRoute("/billing")({
	head: () =>
		createPrivateSeoHead({
			title: pageTitle(billingCopy.seoTitle),
			description: billingCopy.seoDescription,
			path: "/billing",
		}),
	component: BillingRoute,
})

function BillingRoute() {
	return <BillingPage />
}
