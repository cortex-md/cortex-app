import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { marketplaceCopy } from "../content/marketplace"
import { MarketplaceBrowsePage } from "../features/marketplace/MarketplaceBrowsePage"
import { getItemHref } from "../features/marketplace/marketplaceModel"
import { createSeoHead, pageTitle } from "../seo/metadata"
import { breadcrumbSchema, itemListSchema, jsonLdScripts } from "../seo/structuredData"
import { getMarketplaceCatalog } from "../server/marketplace"

const searchSchema = z.object({
	kind: z.enum(["all", "plugins", "themes", "templates"]).catch("all"),
	q: z.string().max(100).catch(""),
	sort: z.enum(["votes", "downloads", "updated"]).catch("votes"),
})

const defaultSearch: z.infer<typeof searchSchema> = { kind: "all", q: "", sort: "votes" }

export const Route = createFileRoute("/marketplace/browse")({
	validateSearch: (search) => searchSchema.parse(search),
	search: {
		middlewares: [
			({ search, next }) => {
				const result = next(search)
				return Object.fromEntries(
					Object.entries(result).filter(
						([key, value]) => value !== defaultSearch[key as keyof typeof defaultSearch],
					),
				) as typeof result
			},
		],
	},
	loader: async () => ({ catalog: await getMarketplaceCatalog() }),
	staleTime: 60_000,
	headers: ({ loaderData }) => ({
		"Cache-Control":
			loaderData?.catalog.status === "ok" && !loaderData.catalog.isStale
				? "public, s-maxage=300, stale-while-revalidate=86400"
				: "no-store",
	}),
	head: ({ loaderData }) => {
		const items = loaderData?.catalog.items ?? []
		return {
			...createSeoHead({
				title: pageTitle(marketplaceCopy.seoTitle),
				description: marketplaceCopy.seoDescription,
				path: "/marketplace/browse",
			}),
			scripts: jsonLdScripts(
				itemListSchema(items.map((item) => ({ name: item.name, path: getItemHref(item) }))),
				breadcrumbSchema([
					{ name: "Marketplace", path: "/marketplace" },
					{ name: "Browse", path: "/marketplace/browse" },
				]),
			),
		}
	},
	component: MarketplaceBrowseRoute,
})

function MarketplaceBrowseRoute() {
	const { catalog } = Route.useLoaderData()
	const search = Route.useSearch()
	const navigate = Route.useNavigate()

	return (
		<MarketplaceBrowsePage
			catalog={catalog}
			search={search}
			onSearchChange={(next, options) =>
				void navigate({
					search: (previous) => ({ ...previous, ...next }),
					replace: options?.replace,
					resetScroll: false,
				})
			}
		/>
	)
}
