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
