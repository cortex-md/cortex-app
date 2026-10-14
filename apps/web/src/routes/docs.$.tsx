import { createFileRoute, notFound } from "@tanstack/react-router"
import { docsDescription } from "../content/docs"
import { DocsShell } from "../features/docs/components/DocsShell"
import { docsNavigation, getDocBySlug } from "../features/docs/registry"
import { createSeoHead, pageTitle } from "../seo/metadata"
import { breadcrumbSchema, jsonLdScripts, techArticleSchema } from "../seo/structuredData"

export const Route = createFileRoute("/docs/$")({
	loader: ({ params }) => {
		const page = getDocBySlug(params._splat)
		if (!page) throw notFound()

		return {
			page,
			navigation: docsNavigation,
		}
	},
	head: ({ loaderData }) => {
		const page = loaderData?.page
		const seoHead = createSeoHead({
			title: pageTitle(page?.title ?? "Docs"),
			description: page?.description ?? docsDescription,
			path: page?.href ?? "/docs",
			type: "article",
		})

		if (!page) return seoHead

		const sectionHref =
			docsNavigation.find((group) => group.section === page.section)?.pages[0]?.href ?? page.href

		return {
			...seoHead,
			scripts: jsonLdScripts(
				techArticleSchema({
					title: page.title,
					description: page.description,
					path: page.href,
					section: page.section,
				}),
				breadcrumbSchema([
					{ name: "Docs", path: "/docs" },
					{ name: page.section, path: sectionHref },
					{ name: page.title, path: page.href },
				]),
			),
		}
	},
	component: DocsPageRoute,
})

function DocsPageRoute() {
	const { page, navigation } = Route.useLoaderData()

	return <DocsShell page={page} navigation={navigation} />
}
