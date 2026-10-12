import type { PropertyColor, PropertyDefinition, PropertyMap, PropertyOption } from "../types"

export const DATABASE_CONFIG_KEY = "database"
export const DATABASE_CONFIG_VERSION = 1
export const DATABASE_TITLE_KEY = "$title"
export const DATABASE_EDITED_KEY = "$edited"
export const DATABASE_NO_VALUE_GROUP = "$none"

export const DATABASE_VIEW_TYPES = ["table", "board", "calendar", "gallery"] as const
export type DatabaseViewType = (typeof DATABASE_VIEW_TYPES)[number]

export const DATABASE_FILTER_OPERATORS = [
	"is",
	"is_not",
	"contains",
	"not_contains",
	"is_empty",
	"is_not_empty",
	"gt",
	"gte",
	"lt",
	"lte",
] as const
export type DatabaseFilterOperator = (typeof DATABASE_FILTER_OPERATORS)[number]

export interface DatabaseFilter {
	key: string
	op: DatabaseFilterOperator
	value?: unknown
}

export type DatabaseSortDirection = "asc" | "desc"

export interface DatabaseSort {
	key: string
	dir: DatabaseSortDirection
}

export interface DatabaseView {
	id: string
	type: DatabaseViewType
	name: string
	group?: string
	date?: string
	cover?: string
	columns?: string[]
	filters?: DatabaseFilter[]
	sort?: DatabaseSort[]
	order?: string[]
}

export interface DatabaseRowTemplate {
	id: string
	name: string
	properties?: PropertyMap
	body?: string
}

export interface DatabaseConfig {
	version: typeof DATABASE_CONFIG_VERSION
	views: DatabaseView[]
	templates?: DatabaseRowTemplate[]
}

export interface DatabaseRow {
	path: string
	title: string
	meta: PropertyMap
	excerpt: string
	preview: string
	cover: string | null
	mtime: number
	size: number
}

export interface DatabaseQueryContext {
	currentUserId: string | null
	today: string
}

export interface DatabaseGroup {
	key: string
	label: string
	option: PropertyOption | null
	value: unknown
	rows: DatabaseRow[]
}

export interface DatabaseQueryResult {
	rows: DatabaseRow[]
	groups: DatabaseGroup[]
	totalCount: number
	matchedCount: number
}

export interface DatabasePropertySpec {
	key: string
	name: string
	type: string
	multiple?: boolean
	options?: Array<{ label: string; color: PropertyColor }>
}

export interface DatabasePresetSample {
	title: string
	values: Record<string, string | number | boolean>
	body?: string
}

export interface DatabasePreset {
	id: string
	name: string
	hint: string
	properties: DatabasePropertySpec[]
	views: Array<Omit<DatabaseView, "id">>
	samples: DatabasePresetSample[]
}

export interface ResolvedDatabaseProperties {
	properties: PropertyDefinition[]
	byKey: ReadonlyMap<string, PropertyDefinition>
}
