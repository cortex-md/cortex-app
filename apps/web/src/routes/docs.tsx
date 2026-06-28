import { createFileRoute, Outlet } from "@tanstack/react-router"
import { siteConfig } from "../config/site"
import docsCss from "../features/docs/docs.css?url"
import { createSeoHead } from "../seo/metadata"

const docsDescription =
	"Documentation for Cortex, a local-first Markdown workspace built around plain files, optional encrypted sync, and extension surfaces."

export const Route = createFileRoute("/docs")({
	head: () => {
		const seoHead = createSeoHead({
			title: `Docs — ${siteConfig.name}`,
			description: docsDescription,
			path: "/docs",
		})

		return {
			...seoHead,
			links: [...seoHead.links, { rel: "stylesheet", href: docsCss }],
		}
	},
	component: DocsLayoutRoute,
})

function DocsLayoutRoute() {
	return <Outlet />
}
