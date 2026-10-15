import { createFileRoute } from "@tanstack/react-router"
import { billingCancelledCopy } from "../content/callback"
import { BillingCancelledPage } from "../features/billing/BillingCallbackPages"
import { createPrivateSeoHead, pageTitle } from "../seo/metadata"

export const Route = createFileRoute("/billing/cancelled")({
	head: () =>
		createPrivateSeoHead({
			title: pageTitle(billingCancelledCopy.seoTitle),
			description: billingCancelledCopy.seoDescription,
			path: "/billing/cancelled",
		}),
	component: BillingCancelledPage,
})
