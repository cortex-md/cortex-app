import { createFileRoute } from "@tanstack/react-router"
import { siteConfig } from "../config/site"

const disallowedPaths = ["/account", "/billing", "/invite/", "/login", "/signup"]

function createRobotsTxt(origin = siteConfig.url) {
	return [
		"User-agent: *",
		"Allow: /",
		...disallowedPaths.map((path) => `Disallow: ${path}`),
		"",
		`Sitemap: ${origin}/sitemap.xml`,
		`Sitemap: ${origin}/sitemap-marketplace.xml`,
		"",
	].join("\n")
}

export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: async () =>
				new Response(createRobotsTxt(), {
					headers: {
						"content-type": "text/plain; charset=utf-8",
						"cache-control": "public, max-age=3600",
					},
				}),
		},
	},
})
