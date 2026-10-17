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
	appRepoUrl: "https://github.com/cortex-md/cortex-app",
	registryRepoUrl: "https://github.com/cortex-md/registry",
	locale: "en_US",
} as const
