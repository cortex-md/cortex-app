import { createCanonicalUrl } from "./metadata"

export interface SitemapUrl {
	path: string
	lastmod?: string | null
}

export const staticSitemapPaths = [
	"/",
	"/sync",
	"/mobile",
	"/cli",
	"/marketplace",
	"/marketplace/browse",
	"/changelog",
	"/roadmap",
] as const

function escapeXml(value: string) {
	return value.replace(/[<>&'"]/gu, (character) => `&#${character.charCodeAt(0)};`)
}

export function renderSitemap(urls: readonly SitemapUrl[]) {
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...urls.map(
			(url) =>
				`  <url><loc>${escapeXml(createCanonicalUrl(url.path))}</loc>${
					url.lastmod ? `<lastmod>${url.lastmod.slice(0, 10)}</lastmod>` : ""
				}</url>`,
		),
		"</urlset>",
		"",
	].join("\n")
}
