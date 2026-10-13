import type { ObsidianProgress } from "@cortex/import-export"

export type ImportStage =
	| "choose"
	| "review"
	| "preview"
	| "done"
	| "detect"
	| "obs"
	| "run"
	| "obsdone"

export type ImportFileKind = "csv" | "html" | "pdf" | "unsupported"

export type ConflictPolicy = "both" | "skip"

export type CsvMode = "table" | "database"

export type DetectChoice = "obs" | "open" | "files"

export type ObsidianMode = "copy" | "open"

export interface ImportSourceFile {
	id: string
	path: string
	name: string
	kind: ImportFileKind
	extensionLabel: string
	csvRowCount: number
	stub: boolean
	stubContent?: string
}

export interface ImportDestination {
	label: string
	relativePath: string
}

export interface PlannedImportFile {
	file: ImportSourceFile
	targetLabel: string
	targetName: string
	notes: number
	status: "ok" | "warn" | "skipped"
}

export type ImportPreview =
	| { kind: "csv-table"; title: string; header: string[]; rows: string[][] }
	| { kind: "csv-database"; title: string; properties: [string, string][]; total: number }
	| { kind: "html"; title: string; markdown: string }
	| { kind: "pdf"; title: string; pages: string[] }
	| { kind: "unsupported"; title: string; message: string }

export interface ImportRunResult {
	rows: { label: string; ok: boolean }[]
	createdPaths: string[]
	notes: number
}

export interface InspectedFolder {
	path: string
	name: string
	locationLabel: string
	isObsidian: boolean
	notes: number
	attachments: number
	templates: number
	bookmarks: number
	totalFiles: number
	importableFiles: ImportSourceFile[]
	stub: boolean
}

export interface ObsidianFindingRow {
	label: string
	examples: string
	count: number
}

export interface ObsidianOutcome {
	mode: ObsidianMode
	cancelled: boolean
	notes: number
	attachments: number
	convertedEmbeds: number
	renamed: number
	settingsApplied: boolean
	settings: { attachmentLocation: string; dailyNotes: string; templates: number; bookmarks: number; propertyTypes: number }
	findings: ObsidianFindingRow[]
	destinationLabel: string
}

export interface ObsidianRunOptions {
	folder: InspectedFolder
	mode: ObsidianMode
	destinationFolder: string
	applySettings: boolean
	onProgress: (progress: ObsidianProgress) => void
	signal: AbortSignal
}
