import type { ZodType } from "zod"

export const BUILT_IN_PROPERTY_TYPES = [
	"text",
	"number",
	"select",
	"tags",
	"person",
	"date",
	"checkbox",
	"url",
	"email",
	"phone",
	"created_time",
	"created_by",
	"last_edited_time",
	"last_edited_by",
	"id",
] as const

export const PROPERTY_COLORS = [
	"blue",
	"green",
	"red",
	"amber",
	"gray",
	"purple",
	"pink",
	"teal",
] as const

export type BuiltInPropertyType = (typeof BUILT_IN_PROPERTY_TYPES)[number]
export type PrimitivePropertyType =
	| "text"
	| "number"
	| "select"
	| "tags"
	| "person"
	| "date"
	| "checkbox"
	| "url"
	| "email"
	| "phone"
export type PropertyColor = (typeof PROPERTY_COLORS)[number]
export type PropertyMap = Record<string, unknown>

export interface PropertyOption {
	id: string
	label: string
	color: PropertyColor
}

export interface PropertyDefinition {
	id: string
	key: string
	name: string
	type: string
	createdAt: string
	options?: PropertyOption[]
	defaultOptionId?: string
	optionSort?: "manual" | "alphabetical"
	observed?: boolean
}

export interface VaultSchema {
	version: 1
	properties: PropertyDefinition[]
}

export interface PropertyValidationResult {
	valid: boolean
	message?: string
}

export interface PropertyTypeDefinition {
	type: string
	baseType: PrimitivePropertyType
	displayName: string
	icon: string
	schema: ZodType<unknown>
	readOnly?: boolean
	deserialize(value: unknown): unknown
	serialize(value: unknown): unknown
	validate(value: unknown): PropertyValidationResult
}

export interface CustomPropertyType extends Omit<PropertyTypeDefinition, "schema"> {
	schema?: ZodType<unknown>
}

export interface PropertyPerson {
	id: string
	label: string
	email?: string
}

export interface PropertyDevice {
	id: string
	label: string
	current?: boolean
}

export type ResolvedPropertyActor =
	| {
			kind: "person"
			id: string
			label: string
			email?: string
			current?: boolean
	  }
	| {
			kind: "device"
			id: string
			label: string
			current?: boolean
	  }
	| {
			kind: "unknown"
			id: string
			label: string
	  }

export interface NoteSourceMetadata {
	source: "local" | "remote"
	synced: boolean
	dirty: boolean
	createdAt?: string | null
	createdBy?: string | null
	lastEditedAt?: string | null
	lastEditedBy?: string | null
}

export type ResolvedAuthorConfig =
	| { variant: "text" }
	| {
			variant: "person"
			options: PropertyPerson[]
			currentUserId: string | null
	  }

export interface PropertyAuthorContext {
	authenticated: boolean
	remoteVaultId: string | null
	currentUserId: string | null
	members: PropertyPerson[]
	currentDeviceId: string
	devices: PropertyDevice[]
}

export interface PropertiesFileService {
	readFile(path: string): Promise<string>
	atomicWriteFile(path: string, content: string): Promise<void>
}

export interface PropertiesNoteService {
	readNote(path: string): Promise<string>
	writeNote(path: string, content: string): Promise<void>
	resolveVaultPath(filePath: string): string | null
	listMarkdownFiles(vaultPath: string): Promise<string[]>
}

export interface PropertiesIdentityService {
	getAuthorContext(vaultPath: string): Promise<PropertyAuthorContext>
}

export interface PropertiesMetadataService {
	getNoteSourceMetadata(filePath: string): Promise<NoteSourceMetadata>
}

export interface PropertiesRuntime {
	files: PropertiesFileService
	notes: PropertiesNoteService
	identity: PropertiesIdentityService
	metadata: PropertiesMetadataService
	now?(): Date
	createId?(): string
}

export interface NotePropertiesSnapshot {
	schema: VaultSchema
	persistedMeta: PropertyMap
	resolvedMeta: PropertyMap
	authorConfig: ResolvedAuthorConfig
	observedDefinitions: PropertyDefinition[]
}

export interface CreatePropertyDefinitionInput {
	name: string
	type: string
	properties?: readonly PropertyDefinition[]
	key?: string
	options?: PropertyOption[]
	defaultOptionId?: string
	optionSort?: "manual" | "alphabetical"
}

export interface PropertyFactoryOptions {
	createId?: () => string
	now?: () => Date
}

export interface FrontmatterResult {
	meta: PropertyMap
	body: string
}

export interface FrontmatterLocation {
	from: number
	to: number
	yaml: string
	body: string
	lineEnding: "\n" | "\r\n"
}

export interface NotePropertiesUiState {
	version: 1
	expanded: Record<string, boolean>
}

export interface FrontmatterExtensionOptions {
	initialMeta?: PropertyMap
	initialError?: string | null
	onChange?(meta: PropertyMap): void
	onError?(error: Error): void
}

export interface FrontmatterEditorState {
	meta: PropertyMap
	error: string | null
}
