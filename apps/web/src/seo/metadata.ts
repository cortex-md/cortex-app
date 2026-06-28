import { siteConfig } from "../config/site"

export const indexRobots = "index, follow"
export const noIndexRobots = "noindex, nofollow"

interface SeoHeadOptions {
	title: string
	description?: string
	path?: string
	robots?: string
	image?: string
	type?: "website" | "article"
}

export function createCanonicalUrl(path = "/") {
	if (/^https?:\/\//u.test(path)) {
		return path
	}

	const normalizedPath = path.startsWith("/") ? path : `/${path}`
	return `${siteConfig.url}${normalizedPath === "/" ? "" : normalizedPath}`
}

export function createSeoHead({
	title,
	description = siteConfig.description,
	path = "/",
	robots = indexRobots,
	image = siteConfig.ogImage,
	type = "website",
}: SeoHeadOptions) {
	const url = createCanonicalUrl(path)

	return {
		meta: [
			{ title },
			{ name: "description", content: description },
			{ name: "robots", content: robots },
			{ property: "og:type", content: type },
			{ property: "og:url", content: url },
			{ property: "og:title", content: title },
			{ property: "og:description", content: description },
			{ property: "og:image", content: image },
			{ property: "og:image:width", content: "1200" },
			{ property: "og:image:height", content: "630" },
			{ property: "og:site_name", content: siteConfig.name },
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: title },
			{ name: "twitter:description", content: description },
			{ name: "twitter:image", content: image },
		],
		links: [{ rel: "canonical", href: url }],
	}
}
