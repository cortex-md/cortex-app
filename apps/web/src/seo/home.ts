import { siteConfig } from "../config/site"
import { homeHero, pricingFaq } from "../content/landing"
import { getPaintingSrc, getPaintingSrcSet } from "../features/site/Painting"
import { createSeoHead } from "./metadata"
import { jsonLdScripts, organizationSchema, softwareApplicationSchema } from "./structuredData"

const homeFeatureList = [
	"Local Markdown vaults",
	"Databases with table, board, calendar and gallery views",
	"Tasks with reminders",
	"Local version history",
	"Obsidian importer",
	"End-to-end encrypted sync",
	"Live collaboration",
	"Plugins, themes and CLI",
	"Self-hosted sync",
]

const websiteSchema = {
	"@type": "WebSite",
	name: siteConfig.name,
	url: siteConfig.url,
	description: siteConfig.description,
}

const faqSchema = {
	"@type": "FAQPage",
	mainEntity: pricingFaq.map(({ question, answer }) => ({
		"@type": "Question",
		name: question,
		acceptedAnswer: {
			"@type": "Answer",
			text: answer,
		},
	})),
}

export function createHomeHead() {
	const seoHead = createSeoHead({
		title: siteConfig.title,
		description: homeHero.description,
		path: "/",
	})

	return {
		...seoHead,
		links: [
			...seoHead.links,
			{
				rel: "preload",
				as: "image",
				type: "image/webp",
				href: getPaintingSrc("dawn", 960),
				imageSrcSet: getPaintingSrcSet("dawn"),
				imageSizes: "(max-width: 640px) 100vw, 1180px",
				fetchPriority: "high" as const,
			},
		],
		scripts: jsonLdScripts(
			softwareApplicationSchema({
				name: siteConfig.name,
				description: siteConfig.description,
				path: "/",
				operatingSystem: "macOS, Windows, Linux",
				featureList: homeFeatureList,
				price: "0",
			}),
			organizationSchema(),
			websiteSchema,
			faqSchema,
		),
	}
}
