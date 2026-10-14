import { createFileRoute } from "@tanstack/react-router"
import { changelogCopy, changelogLinks } from "../content/changelog"
import { ChangelogPage } from "../features/changelog/ChangelogPage"
import docsCss from "../features/docs/docs.css?url"
import { createSeoHead, pageTitle } from "../seo/metadata"

export const Route = createFileRoute("/changelog")({
	loader: async () => {
		const { getChangelogReleases } = await import("../server/changelog")

		return {
			changelog: await getChangelogReleases(),
		}
	},
	headers: () => ({
		"Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
	}),
	head: () => {
		const seoHead = createSeoHead({
			title: pageTitle(changelogCopy.title),
			description: changelogCopy.description,
			path: "/changelog",
			alternates: [
				{ type: "application/rss+xml", title: changelogCopy.feedTitle, href: changelogLinks.feed },
			],
		})

		return {
			...seoHead,
			links: [...seoHead.links, { rel: "stylesheet", href: docsCss }],
		}
	},
	component: ChangelogRoute,
})

function ChangelogRoute() {
	const { changelog } = Route.useLoaderData()

	return <ChangelogPage changelog={changelog} />
}
