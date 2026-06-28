import { createFileRoute, notFound } from "@tanstack/react-router"
import { siteConfig } from "../config/site"
import { DocsShell } from "../features/docs/components/DocsShell"
import { docsNavigation, getDocBySlug } from "../features/docs/registry"
import { createSeoHead } from "../seo/metadata"

export const Route = createFileRoute("/docs/$")({
	loader: ({ params }) => {
		const page = getDocBySlug(params._splat)
		if (!page) throw notFound()

		return {
			page,
			navigation: docsNavigation,
		}
	},
	head: ({ loaderData }) =>
		createSeoHead({
			title: `${loaderData?.page.title ?? "Docs"} — ${siteConfig.name}`,
			description: loaderData?.page.description ?? siteConfig.description,
			path: loaderData?.page.href ?? "/docs",
			type: "article",
		}),
	component: DocsPageRoute,
})

function DocsPageRoute() {
	const { page, navigation } = Route.useLoaderData()

	return <DocsShell page={page} navigation={navigation} />
}
