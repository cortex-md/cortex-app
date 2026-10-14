import { duplicatePropertyDefinition } from "./definitions"
import { projectRawNote, type RawNoteProjection } from "./frontmatter"
import { loadNotePropertiesSnapshot } from "./noteStore"
import { getVaultSchema } from "./schemaPersistence"
import type { NotePropertiesSnapshot, PropertyDefinition, VaultSchema } from "./types"

export interface NotePropertiesPanelInput {
	rawContent?: string
	projection?: RawNoteProjection
}

const emptySchema: VaultSchema = { version: 1, properties: [] }

export function createEmptyNotePropertiesSnapshot(
	schema: VaultSchema = emptySchema,
): NotePropertiesSnapshot {
	return {
		schema,
		persistedMeta: {},
		resolvedMeta: {},
		authorConfig: { variant: "text" },
		observedDefinitions: [],
	}
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export interface NotePropertiesRefreshHandlers {
	applySnapshot: (
		snapshot: NotePropertiesSnapshot,
		projection: RawNoteProjection | undefined,
	) => void
	applySchemaFallback: (schema: VaultSchema) => void
	applyFrontmatterError: (message: string) => void
}

export async function refreshNotePropertiesSnapshot(
	filePath: string,
	vaultPath: string,
	nextInput: NotePropertiesPanelInput,
	{ applySnapshot, applySchemaFallback, applyFrontmatterError }: NotePropertiesRefreshHandlers,
): Promise<void> {
	try {
		const nextProjection =
			nextInput.projection ??
			(nextInput.rawContent === undefined ? undefined : projectRawNote(nextInput.rawContent))
		const nextSnapshot = await loadNotePropertiesSnapshot(
			filePath,
			nextProjection
				? { projection: nextProjection }
				: nextInput.rawContent === undefined
					? undefined
					: { rawContent: nextInput.rawContent },
		)
		applySnapshot(nextSnapshot, nextProjection)
	} catch (refreshError) {
		try {
			const schema = await getVaultSchema(vaultPath)
			applySchemaFallback(schema)
		} catch {}
		applyFrontmatterError(getErrorMessage(refreshError))
	}
}

export function schemaWithRegisteredProperty(
	schema: VaultSchema,
	definition: PropertyDefinition,
): VaultSchema {
	return { version: 1, properties: [...schema.properties, definition] }
}

export function schemaWithUpdatedProperty(
	schema: VaultSchema,
	definition: PropertyDefinition,
): VaultSchema {
	return {
		version: 1,
		properties: schema.properties.map((property) =>
			property.id === definition.id ? definition : property,
		),
	}
}

export function schemaWithoutProperty(
	schema: VaultSchema,
	definition: PropertyDefinition,
): VaultSchema {
	return {
		version: 1,
		properties: schema.properties.filter((candidate) => candidate.id !== definition.id),
	}
}

export function schemaWithDuplicatedProperty(
	schema: VaultSchema,
	definition: PropertyDefinition,
): VaultSchema {
	const duplicate = duplicatePropertyDefinition(definition, schema)
	return { version: 1, properties: [...schema.properties, duplicate] }
}
