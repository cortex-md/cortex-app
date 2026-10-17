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
