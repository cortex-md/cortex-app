import { siteConfig } from "../config/site"

export const indexRobots = "index, follow, max-image-preview:large"
export const noIndexRobots = "noindex, nofollow"

const defaultImageAlt = "Cortex, a local-first Markdown workspace"

interface SeoAlternate {
	type: string
	title: string
	href: string
}

interface SeoHeadOptions {
	title: string
	description?: string
	path?: string
	robots?: string
	image?: string
	imageAlt?: string
	imageWidth?: number
	imageHeight?: number
	type?: "website" | "article"
	alternates?: SeoAlternate[]
	publishedTime?: string
	modifiedTime?: string
}

export function pageTitle(name: string) {
	return `${name} — ${siteConfig.name}`
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
	imageAlt = defaultImageAlt,
	imageWidth = 1200,
	imageHeight = 630,
	type = "website",
	alternates = [],
	publishedTime,
	modifiedTime,
}: SeoHeadOptions) {
	const url = createCanonicalUrl(path)
	const imageUrl = createCanonicalUrl(image)

	return {
		meta: [
			{ title },
			{ name: "description", content: description },
			{ name: "robots", content: robots },
			{ property: "og:type", content: type },
			{ property: "og:url", content: url },
			{ property: "og:title", content: title },
			{ property: "og:description", content: description },
			{ property: "og:image", content: imageUrl },
			{ property: "og:image:alt", content: imageAlt },
			{ property: "og:image:width", content: String(imageWidth) },
			{ property: "og:image:height", content: String(imageHeight) },
			{ property: "og:site_name", content: siteConfig.name },
			...(publishedTime ? [{ property: "article:published_time", content: publishedTime }] : []),
			...(modifiedTime ? [{ property: "article:modified_time", content: modifiedTime }] : []),
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: title },
			{ name: "twitter:description", content: description },
			{ name: "twitter:image", content: imageUrl },
			{ name: "twitter:image:alt", content: imageAlt },
		],
		links: [
			{ rel: "canonical", href: url },
			...alternates.map((alternate) => ({
				rel: "alternate",
				type: alternate.type,
				title: alternate.title,
				href: createCanonicalUrl(alternate.href),
			})),
		],
	}
}

export function createPrivateSeoHead(options: Omit<SeoHeadOptions, "robots">) {
	return createSeoHead({ ...options, robots: noIndexRobots })
}
