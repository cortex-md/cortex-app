export type TemplateShareKind = "note" | "database"

export type TemplateShareAudience = "team" | "link" | "market"

export type TemplateShareStatus = "published" | "pending_review" | "rejected"

export interface TemplateBundleFile {
	path: string
	content: string
}

export interface TemplateBundle {
	format: 1
	kind: TemplateShareKind
	files: TemplateBundleFile[]
}

export interface TemplateShareInfo {
	id: string
	vaultId: string
	kind: TemplateShareKind
	audience: TemplateShareAudience
	groupId: string | null
	groupName: string | null
	ownerId: string
	ownerName: string
	name: string
	description: string
	includeSamples: boolean
	version: number
	status: TemplateShareStatus
	reviewNote: string
	link: string | null
	updatedAt: string
}

export interface PublicTemplateInfo {
	slug: string
	kind: TemplateShareKind
	name: string
	description: string
	ownerName: string
	version: number
	fileCount: number
	updatedAt: string
}

export interface TemplateShareInput {
	kind: TemplateShareKind
	audience: TemplateShareAudience
	groupId: string | null
	name: string
	description: string
	includeSamples: boolean
	bundle: TemplateBundle
}

export interface TemplateSharePatch {
	audience?: TemplateShareAudience
	groupId?: string | null
	name?: string
	description?: string
	includeSamples?: boolean
	bundle?: TemplateBundle
}

export interface TemplateShares {
	list(vaultId: string): Promise<TemplateShareInfo[]>
	share(vaultId: string, input: TemplateShareInput): Promise<TemplateShareInfo>
	update(vaultId: string, templateId: string, patch: TemplateSharePatch): Promise<TemplateShareInfo>
	republish(
		vaultId: string,
		templateId: string,
		audience: TemplateShareAudience,
		bundle: TemplateBundle,
	): Promise<TemplateShareInfo>
	revoke(vaultId: string, templateId: string): Promise<void>
	fetch(vaultId: string, templateId: string): Promise<TemplateBundle>
	market(query: { kind?: TemplateShareKind; text?: string }): Promise<PublicTemplateInfo[]>
	open(slug: string): Promise<{ template: PublicTemplateInfo; bundle: TemplateBundle }>
}
