import type { TemplateShareAudience } from "@cortex/platform"

export type ShareAudience = TemplateShareAudience

export interface ShareGroup {
	id: string | null
	name: string
	memberCount: number
}

export interface ShareSubject {
	folderPath: string | null
	name: string
	description: string
	viewNames: string[]
	propertyCount: number
	rowTemplateNames: string[]
	sampleCount: number
	previewRows: SharePreviewRow[]
	ownerName: string
}

export interface SharePreviewRow {
	title: string
	status: string
	date: string
}

export interface ShareTemplateInput {
	subject: ShareSubject
	audience: ShareAudience
	groupId: string | null
	name: string
	description: string
	includeRowTemplates: boolean
	includeSamples: boolean
}

export interface ShareTemplateOutcome {
	audience: ShareAudience
	groupName: string | null
	link: string | null
	name: string
	stub: boolean
}
