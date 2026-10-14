import { createFileRoute, notFound } from "@tanstack/react-router"
import { docsDescription } from "../content/docs"
import { DocsShell } from "../features/docs/components/DocsShell"
import { createSeoHead, pageTitle } from "../seo/metadata"
import { breadcrumbSchema, jsonLdScripts, techArticleSchema } from "../seo/structuredData"
import { getDocsPage, getDocsSearchEntries } from "../server/docs"

export const Route = createFileRoute("/docs/$")({
	loader: async ({ params }) => {
		const result = await getDocsPage({ data: { slug: params._splat } })
		if (!result) throw notFound()
		return result
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
			loaderData?.navigation.find((group) => group.section === page.section)?.pages[0]?.href ??
			page.href

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

	return (
		<DocsShell
			page={page}
			navigation={navigation}
			loadSearchEntries={() => getDocsSearchEntries()}
		/>
	)
}
