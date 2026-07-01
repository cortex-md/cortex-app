import type { PropertyMap } from "@cortex/properties"

export type DatabaseLayout = "table" | "board"

export const DATABASE_MEMBERSHIP_PROPERTY_KEY = "cortex-databases"

export interface DatabaseEmbedMarker {
	databaseId: string
	viewId: string
}

export type DatabaseSource =
	| { kind: "vault" }
	| { kind: "folder"; path: string }
	| { kind: "tag"; tag: string }

export type DatabaseFilterOperator =
	| "is-empty"
	| "is-not-empty"
	| "equals"
	| "not-equals"
	| "contains"
	| "not-contains"
	| "greater-than"
	| "less-than"
	| "on-or-before"
	| "on-or-after"

export interface DatabaseFilter {
	id: string
	propertyKey: string
	operator: DatabaseFilterOperator
	value?: unknown
}

export type DatabaseSortTarget = "title" | "path" | "updatedAt" | "createdAt" | "property"

export interface DatabaseSort {
	id: string
	target: DatabaseSortTarget
	direction: "asc" | "desc"
	propertyKey?: string
}

export interface DatabaseDefinition {
	id: string
	name: string
	icon: string | null
	defaultViewId: string
	propertyKeys: string[]
	defaultFolder: string
	createdInNotePath: string | null
	createdAt: string
	updatedAt: string
}

export interface DatabaseViewDefinition {
	id: string
	databaseId: string
	name: string
	layout: DatabaseLayout
	filters: DatabaseFilter[]
	sorts: DatabaseSort[]
	visiblePropertyKeys: string[]
	groupByPropertyKey?: string
	createdAt: string
	updatedAt: string
}

export interface DatabaseCatalog {
	version: 1
	databases: Record<string, DatabaseDefinition>
	views: Record<string, DatabaseViewDefinition>
	updatedAt: string
}

export interface DatabaseFileEntry {
	path: string
	name: string
	isDir: boolean
	size?: number
	mtime?: number
}

export interface DatabaseFileFingerprint {
	mtime: number
	size: number
}

export interface DatabaseRow {
	id: string
	filePath: string
	relativePath: string
	title: string
	folder: string
	mtime: number
	size: number
	createdAt: number
	updatedAt: number
	properties: PropertyMap
	frontmatterError: string | null
	fingerprint: DatabaseFileFingerprint
}

export interface DatabaseIndex {
	version: 1
	vaultPath: string
	rowsByPath: Record<string, DatabaseRow>
	fingerprints: Record<string, DatabaseFileFingerprint>
	updatedAt: string
}

export interface DatabaseBoardGroup {
	id: string
	label: string
	optionId: string | null
	rows: DatabaseRow[]
}

export interface DatabaseQueryResult {
	database: DatabaseDefinition
	view: DatabaseViewDefinition
	rows: DatabaseRow[]
	boardGroups: DatabaseBoardGroup[]
}

export interface DatabasesFileService {
	readFile(path: string): Promise<string>
	writeFile(path: string, content: string): Promise<void>
	atomicWriteFile(path: string, content: string): Promise<void>
}

export interface DatabasesNoteService {
	readNote(path: string): Promise<string>
}

export interface DatabasesRuntime {
	files: DatabasesFileService
	notes: DatabasesNoteService
	now?(): Date
	createId?(): string
}

export interface CreateDatabaseInput {
	name: string
	layout: DatabaseLayout
	source?: DatabaseSource
	icon?: string | null
	propertyKeys?: string[]
	defaultFolder?: string
	createdInNotePath?: string | null
	visiblePropertyKeys?: string[]
	groupByPropertyKey?: string
}

export interface CreateDatabaseViewInput {
	databaseId: string
	name: string
	layout: DatabaseLayout
	visiblePropertyKeys?: string[]
	groupByPropertyKey?: string
}
