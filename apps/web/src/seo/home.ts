import { siteConfig } from "../config/site"
import { frequentlyAskedQuestions } from "../content/landing"
import { createSeoHead } from "./metadata"

const softwareApplicationSchema = {
	"@context": "https://schema.org",
	"@type": "SoftwareApplication",
	name: siteConfig.name,
	applicationCategory: "ProductivityApplication",
	operatingSystem: "macOS",
	description: siteConfig.description,
	url: siteConfig.url,
	featureList: [
		"Local Markdown vaults",
		"Live Preview editing",
		"Tags, bookmarks, folders, and properties",
		"Tabs, split panes, hotkeys, and Vim mode",
		"Client-side encrypted sync",
		"Version history",
		"Plugin API, themes, and CLI",
		"Self-hosted sync",
	],
}

const organizationSchema = {
	"@context": "https://schema.org",
	"@type": "Organization",
	name: siteConfig.name,
	url: siteConfig.url,
	logo: `${siteConfig.url}/icon-512.png`,
	sameAs: [siteConfig.githubUrl],
}

const websiteSchema = {
	"@context": "https://schema.org",
	"@type": "WebSite",
	name: siteConfig.name,
	url: siteConfig.url,
	description: siteConfig.description,
}

const faqSchema = {
	"@context": "https://schema.org",
	"@type": "FAQPage",
	mainEntity: frequentlyAskedQuestions.map(({ question, answer }) => ({
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
		description: siteConfig.description,
		path: "/",
	})

	return {
		...seoHead,
		scripts: [softwareApplicationSchema, organizationSchema, websiteSchema, faqSchema].map(
			(schema) => ({
				type: "application/ld+json",
				children: JSON.stringify(schema),
			}),
		),
	}
}
