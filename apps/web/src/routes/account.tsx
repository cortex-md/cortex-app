import { createFileRoute, redirect } from "@tanstack/react-router"
import { accountCopy } from "../content/account"
import { AccountPage } from "../features/account/AccountPage"
import { createPrivateSeoHead, pageTitle } from "../seo/metadata"
import { getAccountOverview } from "../server/account"

export const Route = createFileRoute("/account")({
	head: () =>
		createPrivateSeoHead({
			title: pageTitle(accountCopy.seoTitle),
			description: accountCopy.seoDescription,
			path: "/account",
		}),
	staleTime: 0,
	loader: async () => {
		const overview = await getAccountOverview()

		if (!overview.authenticated) throw redirect({ href: overview.redirectTo })

		return overview
	},
	component: AccountRoute,
})

function AccountRoute() {
	const overview = Route.useLoaderData()
	return <AccountPage initialOverview={overview} />
}
