import { createFileRoute } from "@tanstack/react-router"
import { siteConfig } from "../config/site"
import { ChangelogPage } from "../features/changelog/ChangelogPage"
import docsCss from "../features/docs/docs.css?url"
import { createSeoHead } from "../seo/metadata"

const changelogDescription =
	"Stable public Cortex desktop release notes from GitHub, rendered as readable Markdown."

export const Route = createFileRoute("/changelog")({
	loader: async () => {
		const { getChangelogReleases } = await import("../server/changelog")

		return {
			changelog: await getChangelogReleases(),
		}
	},
	head: ({ loaderData }) => {
		const seoHead = createSeoHead({
			title: `Changelog — ${siteConfig.name}`,
			description: loaderData?.changelog.releases[0]?.title ?? changelogDescription,
			path: "/changelog",
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
