import { Platform } from "react-native"

import type {
	ImportPreview,
	ImportSourceFile,
	InspectedFolder,
	ObsidianOutcome,
} from "@/features/importExport/importTypes"

const STUB_PREFIX = "stub://import/"

export const FIXTURE_CSV_CONTENT = [
	"Region,Revenue,Growth",
	"North,128400,12%",
	"South,96250,8%",
	"East,74900,-3%",
	"West,110020,5%",
].join("\n")

export const FIXTURE_HTML_CONTENT = [
	"<html><body><h1>Team handbook</h1>",
	"<h2>How we work</h2><p>We write things down first. Decisions live in notes, not in chat.</p>",
	"<h2>Meetings</h2><p>Every meeting has an owner, an agenda and a written outcome.</p>",
	"</body></html>",
].join("")

export const FIXTURE_PDF_PAGES = ["[Text extracted from page 1]", "[Text extracted from page 2]"]

export const fixtureImportFiles: ImportSourceFile[] = [
	{
		csvRowCount: 24,
		extensionLabel: "CSV",
		id: "fixture-csv",
		kind: "csv",
		name: "Q3 metrics.csv",
		path: `${STUB_PREFIX}Q3 metrics.csv`,
		stub: true,
		stubContent: FIXTURE_CSV_CONTENT,
	},
	{
		csvRowCount: 0,
		extensionLabel: "HTML",
		id: "fixture-html",
		kind: "html",
		name: "Team handbook.html",
		path: `${STUB_PREFIX}Team handbook.html`,
		stub: true,
		stubContent: FIXTURE_HTML_CONTENT,
	},
	{
		csvRowCount: 0,
		extensionLabel: "PDF",
		id: "fixture-pdf",
		kind: "pdf",
		name: "Research paper.pdf",
		path: `${STUB_PREFIX}Research paper.pdf`,
		stub: true,
	},
	{
		csvRowCount: 0,
		extensionLabel: "Keynote",
		id: "fixture-key",
		kind: "unsupported",
		name: "Slides.key",
		path: `${STUB_PREFIX}Slides.key`,
		stub: true,
	},
]

export const fixtureCsvTablePreview: ImportPreview = {
	header: ["Region", "Revenue", "Growth"],
	kind: "csv-table",
	rows: [
		["North", "128,400", "12%"],
		["South", "96,250", "8%"],
		["East", "74,900", "-3%"],
		["West", "110,020", "5%"],
	],
	title: "Q3 metrics",
}

export const fixtureCsvDatabasePreview: ImportPreview = {
	kind: "csv-database",
	properties: [
		["Region", "North"],
		["Revenue", "128,400"],
		["Growth", "12%"],
	],
	title: "North",
	total: 24,
}

export const fixtureObsidianFolder: InspectedFolder = {
	attachments: 312,
	bookmarks: 24,
	importableFiles: fixtureImportFiles,
	isObsidian: true,
	locationLabel: Platform.OS === "ios" ? "On My iPhone › Obsidian" : "Documents › Obsidian",
	name: "Second brain",
	notes: 1284,
	path: `${STUB_PREFIX}Second brain`,
	stub: true,
	templates: 6,
	totalFiles: 1596,
}

export const fixtureObsidianOutcome: Omit<ObsidianOutcome, "mode" | "cancelled" | "destinationLabel" | "settingsApplied"> = {
	attachments: 312,
	convertedEmbeds: 418,
	findings: [
		{ count: 37, examples: "Projects.md, Reading list.md", label: "Dataview queries" },
		{ count: 52, examples: "Deep work.md, Inbox.md", label: "Highlights shown as text" },
		{
			count: 4,
			examples: "dataview, templater-obsidian, excalidraw, calendar",
			label: "Community plugins",
		},
		{ count: 2, examples: "Roadmap.canvas, Ideas.canvas", label: "Canvas files" },
	],
	notes: 1284,
	renamed: 3,
	settings: {
		attachmentLocation: "Attachments/",
		bookmarks: 24,
		dailyNotes: "Daily/",
		propertyTypes: 5,
		templates: 6,
	},
}

export const FIXTURE_OBSIDIAN_STEP = 200

export const FIXTURE_OBSIDIAN_TICK_MS = 450

export function isStubPath(path: string): boolean {
	return path.startsWith(STUB_PREFIX)
}
