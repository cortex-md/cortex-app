import { createFileRoute } from "@tanstack/react-router"
import { docs } from "../features/docs/registry"
import { renderSitemap, staticSitemapPaths } from "../seo/sitemap"

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async () =>
				new Response(
					renderSitemap([
						...staticSitemapPaths.map((path) => ({ path })),
						...docs.map((doc) => ({ path: doc.href })),
					]),
					{
						headers: {
							"content-type": "application/xml; charset=utf-8",
							"cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
						},
					},
				),
		},
	},
})
