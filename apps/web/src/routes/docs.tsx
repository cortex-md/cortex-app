import { createFileRoute, Outlet } from "@tanstack/react-router"
import { docsDescription } from "../content/docs"
import docsCss from "../features/docs/docs.css?url"
import { createSeoHead, pageTitle } from "../seo/metadata"

export const Route = createFileRoute("/docs")({
	head: () => {
		const seoHead = createSeoHead({
			title: pageTitle("Docs"),
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
