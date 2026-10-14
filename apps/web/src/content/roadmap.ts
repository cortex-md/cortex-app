export type RoadmapStatus = "shipped" | "in-progress" | "planned"

export interface RoadmapItem {
	title: string
	description: string
	area: string
	release?: string
}

export interface RoadmapColumn {
	id: RoadmapStatus
	title: string
	items: RoadmapItem[]
}

export const roadmapCopy = {
	title: "What has shipped, what is in motion,",
	titleQuiet: "and what is next.",
	lead: "Cortex keeps product status explicit so you can tell the shipped workspace apart from the work ahead.",
	description: "What is available in Cortex today and what is still being built.",
	issuesLink: "See open issues on GitHub",
	filterLabel: "Filter by area",
	allAreas: "All",
	openIssue: "Open issue",
	shippedIn: (release: string) => `Shipped in ${release}`,
	empty: "Nothing in this area yet.",
	ideaTitle: "Missing something?",
	ideaDescription: "Open an issue with the feature request template on GitHub.",
	ideaCta: "Suggest an idea",
} as const

const repoUrl = "https://github.com/cortex-md/cortex-app"

export const roadmapLinks = {
	issues: `${repoUrl}/issues`,
	suggestIdea: `${repoUrl}/issues/new?template=feature_request.yml`,
	release: (tag: string) => `${repoUrl}/releases/tag/${tag}`,
	openIssue: (title: string) =>
		`${repoUrl}/issues/new?template=feature_request.yml&title=${encodeURIComponent(title)}`,
} as const

export const roadmapColumns: RoadmapColumn[] = [
	{
		id: "shipped",
		title: "Shipped",
		items: [
			{
				title: "Local Markdown vaults",
				description:
					"Open an existing folder and keep plain Markdown files as the source of truth.",
				area: "Workspace",
				release: "v0.1.0",
			},
			{
				title: "Live Preview editor",
				description: "Write Markdown while formatting, links, and structure stay readable.",
				area: "Writing",
				release: "v0.1.0",
			},
			{
				title: "Tabs, split panes, and search",
				description: "Move across notes and keep nearby context visible while you work.",
				area: "Navigation",
				release: "v0.1.0",
			},
			{
				title: "Tags, bookmarks, and properties",
				description: "Add lightweight organization without replacing your folder structure.",
				area: "Organize",
				release: "v0.1.0",
			},
			{
				title: "Themes, fonts, and hotkeys",
				description: "Tune the writing surface and shortcuts for longer sessions.",
				area: "Personalization",
				release: "v0.1.0",
			},
			{
				title: "Cortex CLI",
				description: "Build and validate plugin or theme work against a local vault.",
				area: "Developers",
			},
		],
	},
	{
		id: "in-progress",
		title: "In progress",
		items: [
			{
				title: "Cortex Sync",
				description:
					"Optional client-side encryption with encrypted blob storage and a self-hostable path.",
				area: "Sync",
			},
			{
				title: "Version history and conflict recovery",
				description: "Make synced edits easier to inspect and recover across devices.",
				area: "Sync",
			},
			{
				title: "Stable Plugin API",
				description:
					"Harden extension surfaces for commands, Markdown transforms, settings, and views.",
				area: "Developers",
			},
			{
				title: "Community plugin and theme registry",
				description:
					"Create a clearer path for discovering extensions without making notes less portable.",
				area: "Developers",
			},
		],
	},
	{
		id: "planned",
		title: "Planned",
		items: [
			{
				title: "Mobile apps",
				description: "Future clients that keep the local-first Markdown model in mind.",
				area: "Clients",
			},
			{
				title: "Public notes",
				description: "A planned sharing surface for selected Markdown content.",
				area: "Sharing",
			},
		],
	},
]

export const roadmapAreas = [
	roadmapCopy.allAreas,
	...new Set(roadmapColumns.flatMap((column) => column.items.map((item) => item.area))),
]
