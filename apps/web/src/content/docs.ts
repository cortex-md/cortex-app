export const docsCopy = {
	rootCrumb: "Docs",
	searchLabel: "Search docs",
	searchPlaceholder: "Search docs...",
	searchDescription: "Search Cortex documentation pages and headings.",
	searchEmpty: "No docs found.",
	navigationLabel: "Docs navigation",
	mobileNavigationLabel: "Browse docs",
	mobileNavigationDescription: "Browse documentation topics.",
	onThisPage: "On this page",
	copyPage: "Copy page as Markdown",
	copied: "Copied",
	llmsIndex: "LLMs index",
	llmsCorpus: "Full docs corpus",
	editOnGitHub: "Edit on GitHub",
	previous: "Previous",
	next: "Next",
	copyCode: "Copy",
	copiedCode: "Copied",
	sectionLinkLabel: "Link to this section",
	minutesRead: (minutes: number) => `${minutes} min read`,
} as const

export const docsDescription =
	"Documentation for Cortex, a local-first Markdown workspace built around plain files, optional encrypted sync, and extension surfaces."

export const docsSourceBaseUrl =
	"https://github.com/cortex-md/cortex-app/blob/main/apps/web/src/content/docs"

export const llmsProductPages = [
	{ title: "Cortex Sync", href: "/sync", description: "Encrypted sync, hosted or self-hosted." },
	{
		title: "Cortex Mobile",
		href: "/mobile",
		description: "Cortex on iOS and Android, in development.",
	},
	{ title: "Cortex CLI", href: "/cli", description: "Build and publish plugins and themes." },
	{
		title: "Cortex Marketplace",
		href: "/marketplace",
		description: "Plugins, themes and templates for Cortex.",
	},
] as const
