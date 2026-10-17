import { createFileRoute, redirect } from "@tanstack/react-router"
import { inviteCopy } from "../content/callback"
import { InvitePage } from "../features/invite/InvitePage"
import { createPrivateSeoHead, pageTitle } from "../seo/metadata"
import { getInvitePreview } from "../server/invite"

export const Route = createFileRoute("/invite/$token")({
	head: () =>
		createPrivateSeoHead({
			title: pageTitle(inviteCopy.seoTitle),
			description: inviteCopy.seoDescription,
			path: "/invite",
		}),
	staleTime: 0,
	loader: async ({ params }) => {
		const preview = await getInvitePreview({ data: { token: params.token } })
		if (preview.status === "unauthenticated") throw redirect({ href: preview.redirectTo })
		return preview
	},
	component: InviteRoute,
})

function InviteRoute() {
	const preview = Route.useLoaderData()
	const { token } = Route.useParams()
	return <InvitePage token={token} preview={preview} />
}
