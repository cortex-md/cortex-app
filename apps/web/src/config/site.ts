const defaultSiteUrl = "https://cortex-md.tech"
const configuredSiteUrl = import.meta.env.SITE_URL?.trim()
const siteUrl = (configuredSiteUrl || defaultSiteUrl).replace(/\/$/, "")

export const siteConfig = {
	name: "Cortex",
	url: siteUrl,
	title: "Cortex — A local-first Markdown workspace",
	description:
		"A fast, open-source Markdown workspace for writing, organizing, syncing, and extending the knowledge you own.",
	ogImage: `${siteUrl}/og-image.png`,
	githubUrl: "https://github.com/cortex-md",
} as const

export const landingNavigation = [
	{ label: "Product", href: "#product" },
	{ label: "Organize", href: "#organize" },
	{ label: "Sync", href: "#sync" },
	{ label: "Pricing", href: "#pricing" },
] as const

export const siteResourceLinks = [
	{
		label: "Docs",
		href: "/docs",
		description: "Guides for writing, organizing, syncing, and extending Cortex.",
	},
	{
		label: "FAQ",
		href: "#faq",
		description: "Short answers about files, sync, open source, and accounts.",
	},
	{
		label: "Changelog",
		href: "/changelog",
		description: "Stable public release notes rendered from GitHub Releases.",
	},
	{
		label: "Roadmap",
		href: "/roadmap",
		description: "What is available today and what is still being built.",
	},
] as const
