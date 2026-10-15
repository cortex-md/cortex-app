import { createFileRoute } from "@tanstack/react-router"
import { getItemHref } from "../features/marketplace/marketplaceModel"
import { renderSitemap } from "../seo/sitemap"

export const Route = createFileRoute("/sitemap-marketplace.xml")({
	server: {
		handlers: {
			GET: async () => {
				const { fetchCachedMarketplaceCatalog } = await import("../server/marketplace")
				const catalog = await fetchCachedMarketplaceCatalog()
				const body = renderSitemap([
					{ path: "/marketplace/browse", lastmod: catalog.generatedAt },
					...catalog.items.map((item) => ({ path: getItemHref(item), lastmod: item.releasedAt })),
				])

				return new Response(body, {
					status: catalog.status === "ok" ? 200 : 503,
					headers: {
						"content-type": "application/xml; charset=utf-8",
						"cache-control":
							catalog.status === "ok"
								? "public, s-maxage=3600, stale-while-revalidate=86400"
								: "no-store",
					},
				})
			},
		},
	},
})
