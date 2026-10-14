import { siteConfig } from "../config/site"
import { createCanonicalUrl } from "./metadata"

type JsonLd = Record<string, unknown>

export function jsonLdScripts(...schemas: JsonLd[]) {
	return schemas.map((schema) => ({
		type: "application/ld+json",
		children: JSON.stringify({ "@context": "https://schema.org", ...schema }),
	}))
}

export function organizationSchema(): JsonLd {
	return {
		"@type": "Organization",
		name: siteConfig.name,
		url: siteConfig.url,
		logo: `${siteConfig.url}/icon-512.png`,
		sameAs: [siteConfig.githubUrl],
	}
}

export function breadcrumbSchema(items: ReadonlyArray<{ name: string; path: string }>): JsonLd {
	return {
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: item.name,
			item: createCanonicalUrl(item.path),
		})),
	}
}

interface SoftwareApplicationOptions {
	name: string
	description: string
	path: string
	operatingSystem?: string
	applicationCategory?: string
	featureList?: readonly string[]
	price?: string
	image?: string
	author?: { name: string; url?: string }
	softwareVersion?: string
	dateModified?: string
	isPartOf?: boolean
}

export function softwareApplicationSchema({
	name,
	description,
	path,
	operatingSystem,
	applicationCategory = "ProductivityApplication",
	featureList,
	price,
	image,
	author,
	softwareVersion,
	dateModified,
	isPartOf,
}: SoftwareApplicationOptions): JsonLd {
	return {
		"@type": "SoftwareApplication",
		name,
		description,
		url: createCanonicalUrl(path),
		applicationCategory,
		...(operatingSystem ? { operatingSystem } : {}),
		...(featureList?.length ? { featureList: [...featureList] } : {}),
		...(price
			? {
					offers: { "@type": "Offer", price: price.replace(/[^0-9.]/gu, ""), priceCurrency: "USD" },
				}
			: {}),
		...(image ? { image: createCanonicalUrl(image) } : {}),
		...(author
			? {
					author: {
						"@type": "Person",
						name: author.name,
						...(author.url ? { url: author.url } : {}),
					},
				}
			: {}),
		...(softwareVersion ? { softwareVersion } : {}),
		...(dateModified ? { dateModified } : {}),
		...(isPartOf
			? { isPartOf: { "@type": "SoftwareApplication", name: siteConfig.name, url: siteConfig.url } }
			: {}),
	}
}

export function techArticleSchema({
	title,
	description,
	path,
	section,
}: {
	title: string
	description: string
	path: string
	section?: string
}): JsonLd {
	return {
		"@type": "TechArticle",
		headline: title,
		description,
		url: createCanonicalUrl(path),
		mainEntityOfPage: createCanonicalUrl(path),
		...(section ? { articleSection: section } : {}),
		inLanguage: "en",
		publisher: organizationSchema(),
	}
}

export function itemListSchema(items: ReadonlyArray<{ name: string; path: string }>): JsonLd {
	return {
		"@type": "ItemList",
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: item.name,
			url: createCanonicalUrl(item.path),
		})),
	}
}
