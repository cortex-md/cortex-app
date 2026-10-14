import type { ThemePalette } from "../lib/registry/types"

export type MarketplaceKind = "plugins" | "themes" | "templates"
export type MarketplaceSort = "votes" | "downloads" | "updated"
export type MarketplaceKindFilter = "all" | MarketplaceKind

export const marketplaceCopy = {
	title: "Marketplace",
	lead: "Plugins, themes and templates for Cortex, voted on by the people who use them.",
	seoTitle: "Marketplace",
	seoDescription:
		"Plugins, themes and templates for Cortex, voted on by the people who use them. Browse what the community built and what comes with Cortex.",
	searchPlaceholder: "Search",
	searchLabel: "Search the Marketplace",
	sortLabel: "Sort",
	kindLabel: "Kind",
	seeAll: "See all",
	builtIn: "Comes with Cortex",
	verified: "Verified",
	emptyTitle: (query: string) => `Nothing matches “${query}”.`,
	emptyBody: "Try another word, or look in all kinds.",
	emptyAction: "Clear search",
	unavailableTitle: "The Marketplace couldn’t load.",
	unavailableBody: "GitHub didn’t answer. Nothing here is cached yet, so try again in a moment.",
	unavailableAction: "Try again",
	staleNotice: "Showing the last list we loaded. GitHub isn’t answering right now.",
	back: "Marketplace",
	screenshots: "Screenshots",
	permissions: "Permissions",
	permissionsNote:
		"Cortex asks for these before the plugin runs. They apply to the vault you install it in.",
	noPermissions: "This plugin doesn’t ask for any permissions.",
	properties: "Properties",
	propertiesNote: "Every row is a Markdown note with these properties in its frontmatter.",
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
	vote: {
		label: "Vote",
		title: "Votes are counted on GitHub",
		body: (name: string) =>
			`Give the ${name} discussion a 👍. Anyone with a GitHub account can vote once, and the count here refreshes every 30 minutes.`,
		bodyWithoutDiscussion:
			"Votes are 👍 reactions in the registry’s GitHub Discussions. Anyone with a GitHub account can vote once, and the count here refreshes every 30 minutes.",
		dismiss: "Not now",
		cta: "Vote on GitHub",
	},
	install: {
		title: "Install it from Cortex",
		steps: (name: string) => `Open Cortex → Marketplace → search ‘${name}’`,
		builtInPluginSteps: "Open Cortex → Settings → Plugins",
		builtInThemeSteps: "Open Cortex → Settings → Appearance",
		builtInTemplateSteps: (name: string) => `Open Cortex → New database → ${name}`,
		body: "Cortex doesn’t open Marketplace links from the browser yet, so it takes one search inside the app.",
		builtInBody: "It comes with Cortex, so there’s nothing to download.",
		openCortex: "Open Cortex",
		getCortex: "Don’t have Cortex yet?",
	},
	opens: {
		community: "Installs from the Marketplace inside Cortex.",
		builtInPlugin: "Comes with Cortex: turn it on in Settings.",
		builtInTheme: "Comes with Cortex: pick it in Settings.",
		builtInTemplate: "Built into Cortex: pick it in the new database dialog.",
	},
} as const

export const marketplaceKindTabs: ReadonlyArray<{ value: MarketplaceKindFilter; label: string }> = [
	{ value: "all", label: "All" },
	{ value: "plugins", label: "Plugins" },
	{ value: "themes", label: "Themes" },
	{ value: "templates", label: "Templates" },
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
		templates: { singular: "Database template", plural: "Templates" },
	}

export const publishingGuideUrl = "/docs/plugins/publishing-and-review"
export const registryDiscussionsUrl = "https://github.com/cortex-md/registry/discussions"
export const reportProblemUrl =
	"https://github.com/cortex-md/registry/issues/new?template=report-extension.yml"
export const cortexAppRepo = "cortex-md/cortex-app"

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

export const builtInThemePalettes: Record<"paper" | "ink", ThemePalette> = {
	paper: {
		label: "Light",
		bg: "#fcfcfb",
		side: "#f6f5f3",
		text: "#1c1917",
		muted: "#8a847d",
		accent: "#e11d48",
		fill: "#fb7185",
		line: "#e8e5e1",
		tag: "#fff1f2",
		tagText: "#be123c",
	},
	ink: {
		label: "Dark",
		bg: "#1e1e1e",
		side: "#282828",
		text: "#f3f3f3",
		muted: "#b8b8b8",
		accent: "#fda4af",
		fill: "#fb7185",
		line: "#373737",
		tag: "#3a101a",
		tagText: "#fda4af",
	},
}

export interface BuiltInPlugin {
	id: string
	name: string
	author: string
	description: string
	icon: string
	version: string
	minAppVersion: string
	capabilities: string[]
}

export interface BuiltInTheme {
	id: "paper" | "ink"
	name: string
	author: string
	description: string
	appearance: string
}

export type TemplateArt = "board" | "table" | "gallery"

export interface BuiltInTemplate {
	id: string
	name: string
	author: string
	description: string
	properties: ReadonlyArray<{ name: string; type: string }>
	views: string[]
	art: TemplateArt
	columnLabel: string
	columns: ReadonlyArray<{ title: string; cards: string[] }>
	rows: ReadonlyArray<{ title: string; value: string }>
}

export const builtInPlugins: BuiltInPlugin[] = [
	{
		id: "github-emoji",
		name: "GitHub Emoji",
		author: "Cortex",
		description: "Convert :emoji_code: to emoji characters in the editor.",
		icon: "smile",
		version: "0.1.0",
		minAppVersion: "0.1.0",
		capabilities: ["editor:write", "workspace:tabs"],
	},
]

export const builtInThemes: BuiltInTheme[] = [
	{
		id: "paper",
		name: "Paper",
		author: "Cortex",
		description: "The default light theme: warm stone neutrals with one rose accent.",
		appearance: "Light",
	},
	{
		id: "ink",
		name: "Ink",
		author: "Cortex",
		description: "The built-in dark theme: graphite surfaces, the same rose accent.",
		appearance: "Dark",
	},
]

export const builtInTemplates: BuiltInTemplate[] = [
	{
		id: "projects",
		name: "Projects",
		author: "Cortex",
		description:
			"Track work as notes: status, owner and due date, as a table, a board or a calendar.",
		properties: [
			{ name: "Status", type: "Select · Backlog, In progress, In review, Done" },
			{ name: "Owner", type: "Person" },
			{ name: "Due", type: "Date" },
		],
		views: ["Table", "Board", "Calendar"],
		art: "board",
		columnLabel: "Status",
		columns: [
			{ title: "Backlog", cards: ["Q4 planning"] },
			{ title: "In progress", cards: ["Website refresh"] },
			{ title: "In review", cards: ["Onboarding guide"] },
			{ title: "Done", cards: [] },
		],
		rows: [
			{ title: "Website refresh", value: "In progress" },
			{ title: "Q4 planning", value: "Backlog" },
			{ title: "Onboarding guide", value: "In review" },
		],
	},
	{
		id: "meetings",
		name: "Meetings",
		author: "Cortex",
		description: "One note per meeting, with the date, who came and what kind of meeting it was.",
		properties: [
			{ name: "Date", type: "Date" },
			{ name: "Attendees", type: "People" },
			{ name: "Type", type: "Select · Weekly, Review, Project" },
		],
		views: ["Table", "Calendar"],
		art: "table",
		columnLabel: "Type",
		columns: [],
		rows: [
			{ title: "Weekly sync", value: "Weekly" },
			{ title: "Design review", value: "Review" },
			{ title: "Kickoff", value: "Project" },
		],
	},
	{
		id: "reading",
		name: "Reading list",
		author: "Cortex",
		description: "Books, articles and papers with author, status and a rating.",
		properties: [
			{ name: "Author", type: "Text" },
			{ name: "Status", type: "Select · To read, Reading, Done" },
			{ name: "Rating", type: "Number" },
		],
		views: ["Gallery", "Table"],
		art: "gallery",
		columnLabel: "Status",
		columns: [],
		rows: [
			{ title: "Book title", value: "Reading" },
			{ title: "Article title", value: "To read" },
			{ title: "Paper title", value: "Done" },
		],
	},
	{
		id: "contacts",
		name: "Contacts",
		author: "Cortex",
		description: "People and companies moving from lead to customer, with a follow-up date.",
		properties: [
			{ name: "Company", type: "Text" },
			{ name: "Stage", type: "Select · Lead, Talking, Customer" },
			{ name: "Follow up", type: "Date" },
		],
		views: ["Board", "Table"],
		art: "board",
		columnLabel: "Stage",
		columns: [
			{ title: "Lead", cards: ["Person A"] },
			{ title: "Talking", cards: ["Person B"] },
			{ title: "Customer", cards: ["Person C"] },
		],
		rows: [
			{ title: "Person A", value: "Lead" },
			{ title: "Person B", value: "Talking" },
			{ title: "Person C", value: "Customer" },
		],
	},
]
