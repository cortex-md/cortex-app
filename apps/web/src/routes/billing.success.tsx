import { createFileRoute } from "@tanstack/react-router"
import { billingSuccessCopy } from "../content/callback"
import { BillingSuccessPage } from "../features/billing/BillingCallbackPages"
import { createPrivateSeoHead, pageTitle } from "../seo/metadata"
import { getSession } from "../server/auth"

export const Route = createFileRoute("/billing/success")({
	head: () =>
		createPrivateSeoHead({
			title: pageTitle(billingSuccessCopy.seoTitle),
			description: billingSuccessCopy.seoDescription,
			path: "/billing/success",
		}),
	staleTime: 0,
	loader: async () => {
		const session = await getSession().catch(() => null)
		return { email: session?.authenticated ? session.session.email : null }
	},
	component: BillingSuccessRoute,
})

function BillingSuccessRoute() {
	const { email } = Route.useLoaderData()
	return <BillingSuccessPage email={email} />
}
