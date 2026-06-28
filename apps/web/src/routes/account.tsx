import { createFileRoute, redirect } from "@tanstack/react-router"
import { siteConfig } from "../config/site"
import { AccountPage } from "../features/account/AccountPage"
import { createSeoHead, noIndexRobots } from "../seo/metadata"
import { getAccountOverview } from "../server/account"

export const Route = createFileRoute("/account")({
	head: () =>
		createSeoHead({
			title: `Account — ${siteConfig.name}`,
			description: "Manage your Cortex account and hosted Sync subscription status.",
			path: "/account",
			robots: noIndexRobots,
		}),
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
