import type { DatabasePreset } from "@cortex/properties/database"

export interface DatabaseRowTemplateFixture {
	id: string
	name: string
	subtitle: string
	title: string
	body: string
}

export interface TeamDatabasePresetFixture {
	shareId: string
	groupName: string
	ownerName: string
	preset: DatabasePreset
}

export const ROW_TEMPLATE_FIXTURES: DatabaseRowTemplateFixture[] = [
	{
		body: "Created from the Project brief template.\n\n## Goal\n\n\n\n## Risks\n\n",
		id: "project-brief",
		name: "Project brief",
		subtitle: "Goal · Risks",
		title: "Untitled project",
	},
	{
		body: "Created from the Bug report template.\n\n## Steps\n\n1. \n",
		id: "bug-report",
		name: "Bug report",
		subtitle: "Steps",
		title: "Untitled bug",
	},
]

export const TEAM_PRESET_FIXTURES: TeamDatabasePresetFixture[] = [
	{
		groupName: "Design",
		ownerName: "Ana Moreira",
		preset: {
			hint: "status · owner · sprint",
			id: "sprint-board",
			name: "Sprint board",
			properties: [
				{
					key: "status",
					name: "Status",
					options: [
						{ color: "gray", label: "To do" },
						{ color: "pink", label: "Doing" },
						{ color: "green", label: "Done" },
					],
					type: "select",
				},
				{ key: "owner", name: "Owner", type: "person" },
				{
					key: "sprint",
					name: "Sprint",
					options: [
						{ color: "blue", label: "Sprint 41" },
						{ color: "teal", label: "Sprint 42" },
					],
					type: "select",
				},
			],
			samples: [
				{ title: "Story title", values: { sprint: "Sprint 42", status: "To do" } },
				{ title: "Bug title", values: { sprint: "Sprint 42", status: "Doing" } },
				{ title: "Spike", values: { sprint: "Sprint 41", status: "Done" } },
			],
			views: [
				{ group: "status", name: "Board", type: "board" },
				{ columns: ["status", "owner", "sprint"], name: "Table", type: "table" },
			],
		},
		shareId: "fixture-sprint-board",
	},
	{
		groupName: "Design",
		ownerName: "Bruno Kim",
		preset: {
			hint: "date · participant · insight",
			id: "research-log",
			name: "Research log",
			properties: [
				{ key: "date", name: "Date", type: "date" },
				{ key: "participant", name: "Participant", type: "person" },
				{ key: "insight", name: "Insight", type: "text" },
			],
			samples: [
				{ title: "Interview 1", values: { date: "2026-10-03", insight: "[Insight]" } },
				{ title: "Interview 2", values: { date: "2026-10-06", insight: "[Insight]" } },
				{ title: "Survey", values: { date: "2026-10-09", insight: "[Insight]" } },
			],
			views: [
				{
					columns: ["date", "participant", "insight"],
					name: "Table",
					sort: [{ dir: "desc", key: "date" }],
					type: "table",
				},
				{ name: "Gallery", type: "gallery" },
			],
		},
		shareId: "fixture-research-log",
	},
]
