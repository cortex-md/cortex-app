export type MarketplaceKind = "plugins" | "themes"
export type MarketplaceSort = "votes" | "downloads" | "updated"
export type MarketplaceKindFilter = "all" | MarketplaceKind

export const marketplaceCopy = {
	title: "Marketplace",
	lead: "Plugins and themes for Cortex, voted on by the people who use them.",
	seoTitle: "Marketplace",
	seoDescription:
		"Plugins and themes for Cortex, built by the community and voted on by the people who use them.",
	searchPlaceholder: "Search",
	searchLabel: "Search the Marketplace",
	sortLabel: "Sort",
	kindLabel: "Kind",
	seeAll: "See all",
	verified: "Verified",
	emptyTitle: (query: string) => `Nothing matches “${query}”.`,
	emptyBody: "Try another word, or look in all kinds.",
	emptyAction: "Clear search",
	emptyKindTitle: (label: string) => `No ${label} listed yet.`,
	emptyKindBody:
		"Community plugins and themes show up here after a review. Made one? Publish it with the Cortex CLI.",
	emptyKindAction: "Publishing guide",
	unavailableTitle: "The Marketplace couldn’t load.",
	unavailableBody: "GitHub didn’t answer. Nothing here is cached yet, so try again in a moment.",
	unavailableAction: "Try again",
	staleNotice: "Showing the last list we loaded. GitHub isn’t answering right now.",
	back: "Marketplace",
	screenshots: "Screenshots",
	previousScreenshot: "Previous screenshot",
	nextScreenshot: "Next screenshot",
	permissions: "Permissions",
	permissionsNote:
		"Cortex asks for these before the plugin runs. They apply to the vault you install it in.",
	noPermissions: "This plugin doesn’t ask for any permissions.",
	information: "Information",
	readme: "README",
	report: "Report a problem",
	missingCapabilities: "Its manifest couldn’t be read, so its permissions aren’t listed yet.",
	submit: {
		title: "Made a plugin or theme?",
		bodyBefore: "Run",
		command: "cortex submit",
		bodyAfter:
			"from its repository. After a review it’s listed here, with its own thread for votes.",
		cta: "Publishing guide",
	},
	comments: {
		title: "Comments",
		empty: "No comments yet. Reviews, questions and feedback live in its GitHub discussion.",
		unavailable: "Comments couldn’t load from GitHub right now.",
		cta: "Comment on GitHub",
		seeAll: (total: number) => `See all ${total} comments on GitHub`,
		maintainer: "Maintainer",
		author: "Author",
		replies: (count: number) => `${count} ${count === 1 ? "reply" : "replies"}`,
	},
	vote: {
		label: "Vote",
		title: "Votes are counted on GitHub",
		body: (name: string) =>
			`Upvote the ${name} discussion on GitHub. Anyone with a GitHub account can vote once, and the count here refreshes every 30 minutes.`,
		bodyWithoutDiscussion:
			"Votes are upvotes in the registry’s GitHub Discussions. Anyone with a GitHub account can vote once, and the count here refreshes every 30 minutes.",
		dismiss: "Not now",
		cta: "Vote on GitHub",
	},
	install: {
		title: "Install it from Cortex",
		steps: (name: string) => `Open Cortex → Marketplace → search ‘${name}’`,
		body: "Cortex doesn’t open Marketplace links from the browser yet, so it takes one search inside the app.",
		openCortex: "Open Cortex",
		getCortex: "Don’t have Cortex yet?",
	},
	opens: "Installs from the Marketplace inside Cortex.",
} as const

export const marketplaceKindTabs: ReadonlyArray<{ value: MarketplaceKindFilter; label: string }> = [
	{ value: "all", label: "All" },
	{ value: "plugins", label: "Plugins" },
	{ value: "themes", label: "Themes" },
]

export const marketplaceSortOptions: ReadonlyArray<{ value: MarketplaceSort; label: string }> = [
	{ value: "votes", label: "Most votes" },
	{ value: "downloads", label: "Most downloads" },
	{ value: "updated", label: "Recently updated" },
]

export const marketplaceKindLabels: Record<MarketplaceKind, { singular: string; plural: string }> =
	{
		plugins: { singular: "Plugin", plural: "Plugins" },
		themes: { singular: "Theme", plural: "Themes" },
	}

export const publishingGuideUrl = "/docs/plugins/publishing-and-review"
export const registryDiscussionsUrl = "https://github.com/cortex-md/registry/discussions"
export const reportProblemUrl =
	"https://github.com/cortex-md/registry/issues/new?template=report-extension.yml"

const capabilityLabels: Record<string, string> = {
	"vault:read": "Read vault files",
	"vault:write": "Write vault files",
	"vault:delete": "Delete vault files",
	"vault:watch": "Watch vault changes",
	"editor:read": "Read active editor",
	"editor:write": "Write editor content",
	"editor:extensions": "Add editor extensions",
	"markdown:extensions": "Extend Markdown",
	"ui:views": "Show custom views",
	"ui:sidebar": "Add sidebar entries",
	"ui:statusbar": "Add status bar items",
	"ui:contextmenu": "Add context menu actions",
	"ui:modals": "Open modal views",
	"workspace:tabs": "Open workspace tabs",
	commands: "Register commands",
	settings: "Store settings",
	"theme:read": "Read active theme",
	"bookmarks:read": "Read bookmarks",
	"bookmarks:write": "Update bookmarks",
	"properties:types": "Add property types",
	data: "Store plugin data",
	notifications: "Send notifications",
}

export function getCapabilityLabel(capability: string) {
	const label = capabilityLabels[capability]
	if (label) return label
	return capability
		.split(/[:_-]/u)
		.filter(Boolean)
		.map((part, index) => (index === 0 ? `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}` : part))
		.join(" ")
}
