import type { RemoteTemplateEntry } from "@cortex/core"
import type { DatabasePreset } from "@cortex/properties/database"

export interface TeamTemplateMeta {
	ownerName: string
	groupName: string
	updatedLabel: string
}

export interface DatabasePreviewRow {
	name: string
	status: string
}

export interface DatabaseTemplate {
	id: string
	name: string
	defaultName: string
	defaultFolder: string
	meta: TeamTemplateMeta | null
	preset: DatabasePreset
	previewRows: DatabasePreviewRow[]
}

export interface MarketNoteTemplate {
	id: string
	name: string
	targetFolderPattern: string
	fileNamePattern: string
	body: string
}

export const FIXTURE_TEAM_GROUP = "Design"

const designReviewBody = `---
Date: "{{ date.today }}"
Reviewers: Ana, Bruno
Status: Open
---
## What we’re reviewing


## Decisions


## Follow-ups

- [ ]
`

const researchInterviewBody = `---
Date: "{{ date.today }}"
Participant: —
---
## Context


## Quotes


## Insights

`

export const FIXTURE_TEAM_NOTE_TEMPLATES: RemoteTemplateEntry[] = [
	{
		definition: {
			id: "team-design-review",
			name: "Design review",
			bodyPath: "team-design-review.md",
			targetFolderPattern: "Design/Reviews",
			fileNamePattern: "{{ note.title }}",
			askName: true,
			source: "team",
			remote: { id: "share-design-review", version: 1, sharedBy: "Ana Moreira", group: "Design" },
			createdAt: "2026-10-09T09:00:00.000Z",
			updatedAt: "2026-10-09T09:00:00.000Z",
		},
		body: designReviewBody,
	},
	{
		definition: {
			id: "team-research-interview",
			name: "Research interview",
			bodyPath: "team-research-interview.md",
			targetFolderPattern: "Design/Research",
			fileNamePattern: "{{ note.title }}",
			askName: true,
			source: "team",
			remote: {
				id: "share-research-interview",
				version: 1,
				sharedBy: "Bruno Kim",
				group: "Design",
			},
			createdAt: "2026-09-28T09:00:00.000Z",
			updatedAt: "2026-09-28T09:00:00.000Z",
		},
		body: researchInterviewBody,
	},
]

export const FIXTURE_TEAM_DATABASE_TEMPLATES: DatabaseTemplate[] = [
	{
		id: "team-sprint-board",
		name: "Sprint board",
		defaultName: "Sprint 42",
		defaultFolder: "Design",
		meta: { ownerName: "Ana Moreira", groupName: "Design", updatedLabel: "Oct 2" },
		preset: {
			id: "team-sprint-board",
			name: "Sprint board",
			hint: "status · owner",
			properties: [
				{
					key: "status",
					name: "Status",
					type: "select",
					options: [
						{ label: "To do", color: "gray" },
						{ label: "Doing", color: "pink" },
						{ label: "Done", color: "green" },
					],
				},
				{ key: "owner", name: "Owner", type: "person" },
			],
			views: [
				{ type: "board", name: "Board", group: "status" },
				{ type: "table", name: "Table", columns: ["status", "owner"] },
			],
			samples: [],
			rowTemplates: [
				{
					name: "Story",
					properties: { status: "To do" },
					body: "## Acceptance criteria\n\n- [ ] \n",
				},
				{ name: "Bug", properties: { status: "To do" }, body: "## Steps to reproduce\n\n1. \n" },
			],
		},
		previewRows: [
			{ name: "Story title", status: "To do" },
			{ name: "Bug title", status: "Doing" },
			{ name: "Spike", status: "Done" },
		],
	},
]

export const FIXTURE_MARKET_NOTE_TEMPLATES: MarketNoteTemplate[] = [
	{
		id: "meeting",
		name: "Meeting",
		targetFolderPattern: "Meetings",
		fileNamePattern: "{{ date.today }} {{ note.title | title }}",
		body: `---
Date: "{{ date.today }}"
Attendees:
Type: Weekly
---
## Agenda


## Notes

{{ note.title | title }} with the {{ vault.name }} team.

## Action items

- [ ] Send notes to attendees
`,
	},
	{
		id: "weekly",
		name: "Weekly review",
		targetFolderPattern: "Reviews",
		fileNamePattern: "{{ date.year }}-W{{ date.week }}",
		body: `---
Week: "{{ date.year }}-W{{ date.week }}"
---
## What went well


## Next week

- [ ] 
`,
	},
]

export const MARKET_DATABASE_PRESET_IDS: Record<string, string> = {
	content: "empty",
	projects: "projects",
	reading: "reading",
}
