export type ProductIcon = "desktop" | "mobile" | "cli" | "sync" | "publish" | "marketplace"

export interface ProductNavItem {
	label: string
	description: string
	icon: ProductIcon
	href?: string
	pill?: { label: string; tone: "new" | "soon" }
}

export interface FooterLinkItem {
	label: string
	href?: string
}

export const siteTagline = "A local-first Markdown workspace built in the open."

export const productFeature = {
	pill: "New",
	title: "Databases, tasks and version history",
	description: "Everything new in Cortex, still in plain Markdown.",
	cta: "See what’s new",
	href: "/#features",
} as const

export const productNavGroups: ReadonlyArray<{ title: string; items: ProductNavItem[] }> = [
	{
		title: "Apps",
		items: [
			{
				label: "Desktop",
				description: "macOS, Windows and Linux",
				icon: "desktop",
				href: "/#download",
			},
			{
				label: "Mobile",
				description: "iOS and Android",
				icon: "mobile",
				href: "/mobile",
				pill: { label: "In development", tone: "soon" },
			},
			{ label: "CLI", description: "Build and publish plugins", icon: "cli", href: "/cli" },
		],
	},
	{
		title: "Services",
		items: [
			{
				label: "Sync",
				description: "Encrypted, hosted or self-hosted",
				icon: "sync",
				href: "/sync",
			},
			{
				label: "Publish",
				description: "Share a note as a web page",
				icon: "publish",
				pill: { label: "Soon", tone: "soon" },
			},
			{
				label: "Marketplace",
				description: "Plugins, themes and templates",
				icon: "marketplace",
				href: "/marketplace",
			},
		],
	},
]

export const primaryNavLinks = [
	{ label: "Sync", href: "/sync" },
	{ label: "Marketplace", href: "/marketplace" },
	{ label: "Pricing", href: "/#pricing" },
] as const

export const resourceNavLinks = [
	{
		label: "Docs",
		href: "/docs",
		description: "Guides for writing, organizing, syncing and extending Cortex.",
	},
	{
		label: "Changelog",
		href: "/changelog",
		description: "Release notes for every stable version.",
	},
	{
		label: "Roadmap",
		href: "/roadmap",
		description: "What is available today and what is still being built.",
	},
] as const

export const mobileNavLinks: ReadonlyArray<{ label: string; href?: string; pill?: string }> = [
	{ label: "Desktop", href: "/#download" },
	{ label: "Mobile", href: "/mobile", pill: "In development" },
	{ label: "Sync", href: "/sync" },
	{ label: "Marketplace", href: "/marketplace" },
	{ label: "Publish", pill: "Soon" },
	{ label: "CLI", href: "/cli" },
	{ label: "Pricing", href: "/#pricing" },
]

export const headerActions = {
	download: { label: "Download", href: "/#download" },
	signIn: { label: "Sign in", href: "/login?redirect=/account" },
	account: { label: "Account", href: "/account" },
} as const

export const footerSocialLinks: FooterLinkItem[] = [
	{ label: "GitHub", href: "https://github.com/cortex-md" },
]

export const footerLinkGroups: ReadonlyArray<{ title: string; links: FooterLinkItem[] }> = [
	{
		title: "Get started",
		links: [
			{ label: "Download", href: "/#download" },
			{ label: "Pricing", href: "/#pricing" },
			{ label: "Account", href: "/account" },
		],
	},
	{
		title: "Cortex",
		links: [
			{ label: "Desktop", href: "/#download" },
			{ label: "Mobile", href: "/mobile" },
			{ label: "Sync", href: "/sync" },
			{ label: "Marketplace", href: "/marketplace" },
			{ label: "Publish" },
			{ label: "CLI", href: "/cli" },
		],
	},
	{
		title: "Learn",
		links: [
			{ label: "Docs", href: "/docs" },
			{ label: "Changelog", href: "/changelog" },
			{ label: "Roadmap", href: "/roadmap" },
		],
	},
	{
		title: "Community",
		links: [
			{ label: "GitHub", href: "https://github.com/cortex-md" },
			{ label: "Marketplace", href: "/marketplace/browse" },
			{ label: "Plugins", href: "/marketplace/browse?kind=plugins" },
			{ label: "Themes", href: "/marketplace/browse?kind=themes" },
		],
	},
]

export const footerCopyright = "© 2026 Cortex"
