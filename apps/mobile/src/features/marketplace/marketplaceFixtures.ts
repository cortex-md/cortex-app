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
