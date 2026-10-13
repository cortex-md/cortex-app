export type ThemeGroup = "installed" | "discover"

export interface MarketplaceTheme {
	id: string
	name: string
	author: string
	meta: string
	group: ThemeGroup
	builtIn: boolean
	scheme?: "light" | "dark"
	version: string
	modes: string
	description: string
	source: string
}

export type TemplateGroup = "team" | "vault" | "market"

export interface MarketplaceTemplate {
	id: string
	name: string
	author: string
	isDatabase: boolean
	group: TemplateGroup
	version: string
	updated: string
	source: string
	includes: string
	destination?: string
	lead: string
	files: string[]
	preview: [string, string][]
}

export const FIXTURE_THEMES: MarketplaceTheme[] = [
	{
		id: "paper",
		name: "Paper",
		author: "Built-in",
		meta: "Built-in · Light",
		group: "installed",
		builtIn: true,
		scheme: "light",
		version: "Built-in",
		modes: "Light",
		description: "The default light theme: warm paper tones and a calm accent.",
		source: "Cortex",
	},
	{
		id: "ink",
		name: "Ink",
		author: "Built-in",
		meta: "Built-in · Dark",
		group: "installed",
		builtIn: true,
		scheme: "dark",
		version: "Built-in",
		modes: "Dark",
		description: "The default dark theme: deep ink tones for low light.",
		source: "Cortex",
	},
	{
		id: "sepia",
		name: "Sepia",
		author: "ouro",
		meta: "ouro · 1.1.0",
		group: "installed",
		builtIn: false,
		version: "1.1.0",
		modes: "Light, Dark",
		description: "Warm paper tones with a book serif for headings. Light and dark.",
		source: "GitHub",
	},
	{
		id: "fjord",
		name: "Fjord",
		author: "tomasz",
		meta: "tomasz · 0.4.0",
		group: "installed",
		builtIn: false,
		version: "0.4.0",
		modes: "Light, Dark",
		description: "Cool blues and greys inspired by northern light.",
		source: "GitHub",
	},
	{
		id: "graphite",
		name: "Graphite",
		author: "lena-dev",
		meta: "lena-dev",
		group: "discover",
		builtIn: false,
		version: "1.0.0",
		modes: "Dark",
		description: "A neutral graphite dark theme with high-contrast headings.",
		source: "GitHub",
	},
	{
		id: "meadow",
		name: "Meadow",
		author: "mira",
		meta: "mira",
		group: "discover",
		builtIn: false,
		version: "0.9.1",
		modes: "Light",
		description: "Soft greens and a rounded sans for a lighter page.",
		source: "GitHub",
	},
]

export const FIXTURE_TEMPLATES: MarketplaceTemplate[] = [
	{
		id: "review",
		name: "Design review",
		author: "Ana Moreira · Design",
		isDatabase: false,
		group: "team",
		version: "v3",
		updated: "Oct 9, 2026",
		source: "Shared with Design",
		includes: "1 template",
		lead: "Shared with your team. It shows up in New from template and in /template in every vault shared with Design — nothing to install.",
		files: ["Nothing added — used straight from the team library"],
		preview: [
			["Reviewers", "Ana, Bruno"],
			["Status", "Open"],
		],
	},
	{
		id: "sprint",
		name: "Sprint board",
		author: "Ana Moreira · Design",
		isDatabase: true,
		group: "team",
		version: "v2",
		updated: "Oct 2, 2026",
		source: "Shared with Design",
		includes: "2 views · 2 row templates",
		lead: "Shared with your team. Pick it in New database or New from template to create your own copy.",
		files: ["Creates a folder with the views and row templates when you use it"],
		preview: [["Name", "Status · Owner"]],
	},
	{
		id: "meeting",
		name: "Meeting notes",
		author: "cortex-community",
		isDatabase: false,
		group: "vault",
		version: "1.1.0",
		updated: "Sep 30, 2026",
		source: "Published in Cortex",
		includes: "1 template",
		destination: "Templates",
		lead: "Agenda, notes and action items. Action items show up in Today.",
		files: ["Templates/", "Meeting.md"],
		preview: [
			["Date", "Today"],
			["Attendees", "—"],
		],
	},
	{
		id: "projects",
		name: "Projects & roadmap",
		author: "cortex-community",
		isDatabase: true,
		group: "market",
		version: "1.2.0",
		updated: "Oct 8, 2026",
		source: "Published in Cortex",
		includes: "3 views · 2 row templates",
		destination: "Work / Projects",
		lead: "Track work by status, owner and due date. Opens as a table, board and calendar.",
		files: ["Projects/Projects.md", "Templates/Project brief.md", "Templates/Bug report.md"],
		preview: [
			["Website refresh", "In progress"],
			["Q4 planning", "Backlog"],
			["Onboarding guide", "In review"],
		],
	},
	{
		id: "reading",
		name: "Reading list",
		author: "ouro",
		isDatabase: true,
		group: "market",
		version: "0.4.0",
		updated: "Oct 2, 2026",
		source: "GitHub",
		includes: "2 views · 1 row template",
		destination: "Reading",
		lead: "Books and articles with a rating, shown as a gallery of covers.",
		files: ["Reading/Reading.md", "Templates/Book.md"],
		preview: [["[Book title]", "Reading"]],
	},
	{
		id: "weekly",
		name: "Weekly review",
		author: "mira",
		isDatabase: false,
		group: "market",
		version: "2.0.0",
		updated: "Aug 21, 2026",
		source: "Published in Cortex",
		includes: "1 template",
		destination: "Templates",
		lead: "A short Sunday check-in: what went well, what to change, what is next.",
		files: ["Templates/Weekly review.md"],
		preview: [["Week", "2026-W41"]],
	},
	{
		id: "content",
		name: "Content calendar",
		author: "lena-dev",
		isDatabase: true,
		group: "market",
		version: "1.0.3",
		updated: "Sep 12, 2026",
		source: "GitHub",
		includes: "2 views · 1 row template",
		destination: "Content",
		lead: "Plan posts by publish date and channel.",
		files: ["Content/Content.md", "Templates/Post.md"],
		preview: [
			["Launch post", "Blog · Oct 20"],
			["Newsletter #1", "Email · Oct 24"],
			["Changelog recap", "Blog · Nov 2"],
		],
	},
]
