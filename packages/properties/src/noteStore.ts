import { resolveAuthorConfig, resolvePropertyActorValue } from "./actors"
import { getObservedPropertyDefinitions } from "./discovery/observed"
import { invalidatePropertySuggestions } from "./discovery/suggestions"
import {
	parseFrontmatter,
	type RawNoteProjection,
	removeFrontmatterValue,
	setFrontmatterValue,
} from "./frontmatter"
import { getPropertyType } from "./registry"
import { getPropertiesRuntime } from "./runtime"
import { getVaultSchema } from "./schemaStore"
import type {
	NotePropertiesSnapshot,
	NoteSourceMetadata,
	PropertyAuthorContext,
	PropertyMap,
	VaultSchema,
} from "./types"
import { isEmptyPropertyValue } from "./values"

export interface LoadNotePropertiesSnapshotOptions {
	rawContent?: string
	projection?: RawNoteProjection
}

function resolveSystemPropertyMap(
	meta: PropertyMap,
	schema: VaultSchema,
	sourceMetadata: NoteSourceMetadata,
	authorContext: PropertyAuthorContext,
): PropertyMap {
	const resolved = { ...meta }
	const remoteAuthoritative =
		sourceMetadata.source === "remote" && sourceMetadata.synced && !sourceMetadata.dirty
	for (const definition of schema.properties) {
		const current = meta[definition.key]
		let value = current
		if (definition.type === "created_time") {
			value = remoteAuthoritative
				? (sourceMetadata.createdAt ?? current)
				: (current ?? sourceMetadata.createdAt)
		}
		if (definition.type === "created_by") {
			value = remoteAuthoritative
				? (sourceMetadata.createdBy ?? current)
				: (current ?? sourceMetadata.createdBy)
		}
		if (definition.type === "last_edited_time") {
			value = remoteAuthoritative
				? (sourceMetadata.lastEditedAt ?? current)
				: (current ?? sourceMetadata.lastEditedAt)
		}
		if (definition.type === "last_edited_by") {
			value = remoteAuthoritative
				? (sourceMetadata.lastEditedBy ?? current)
				: (current ?? sourceMetadata.lastEditedBy)
		}
		if (
			(definition.type === "created_by" || definition.type === "last_edited_by") &&
			!isEmptyPropertyValue(value)
		) {
			resolved[definition.key] = resolvePropertyActorValue(authorContext, value)
		} else if (value !== undefined) {
			resolved[definition.key] = value
		}
	}
	return resolved
}

export async function getPropertyMap(filePath: string): Promise<PropertyMap> {
	const raw = await getPropertiesRuntime().notes.readNote(filePath)
	return parseFrontmatter(raw).meta
}

export async function loadNotePropertiesSnapshot(
	filePath: string,
	options: LoadNotePropertiesSnapshotOptions = {},
): Promise<NotePropertiesSnapshot> {
	const runtime = getPropertiesRuntime()
	const vaultPath = runtime.notes.resolveVaultPath(filePath)
	if (!vaultPath) throw new Error(`Cannot resolve vault for "${filePath}"`)
	const rawLoad =
		options.projection !== undefined
			? Promise.resolve(options.projection.rawContent)
			: options.rawContent === undefined
				? runtime.notes.readNote(filePath)
				: Promise.resolve(options.rawContent)
	const [raw, schema, sourceMetadata, authorContext] = await Promise.all([
		rawLoad,
		getVaultSchema(vaultPath),
		runtime.metadata.getNoteSourceMetadata(filePath),
		runtime.identity.getAuthorContext(vaultPath),
	])
	const persistedMeta = options.projection?.meta ?? parseFrontmatter(raw).meta
	return {
		schema,
		persistedMeta,
		resolvedMeta: resolveSystemPropertyMap(persistedMeta, schema, sourceMetadata, authorContext),
		authorConfig: resolveAuthorConfig(authorContext),
		observedDefinitions: getObservedPropertyDefinitions(persistedMeta, schema),
	}
}

export async function setProperty(filePath: string, key: string, value: unknown): Promise<void> {
	if (isEmptyPropertyValue(value)) {
		await removeProperty(filePath, key)
		return
	}
	const runtime = getPropertiesRuntime()
	const vaultPath = runtime.notes.resolveVaultPath(filePath)
	if (!vaultPath) throw new Error(`Cannot resolve vault for "${filePath}"`)
	const schema = await getVaultSchema(vaultPath)
	const definition = schema.properties.find((property) => property.key === key)
	if (definition) {
		const type = getPropertyType(definition.type)
		if (!type) throw new Error(`Property type "${definition.type}" is unavailable`)
		if (type.readOnly) throw new Error(`Property "${definition.name}" is read-only`)
		const validation = type.validate(value)
		if (!validation.valid) throw new Error(validation.message ?? "Invalid property value")
		value = type.serialize(value)
	}
	const raw = await runtime.notes.readNote(filePath)
	await runtime.notes.writeNote(filePath, setFrontmatterValue(raw, key, value))
	invalidatePropertySuggestions(vaultPath)
}

export async function removeProperty(filePath: string, key: string): Promise<void> {
	const runtime = getPropertiesRuntime()
	const raw = await runtime.notes.readNote(filePath)
	const updated = removeFrontmatterValue(raw, key)
	if (updated !== raw) await runtime.notes.writeNote(filePath, updated)
	const vaultPath = runtime.notes.resolveVaultPath(filePath)
	if (vaultPath) invalidatePropertySuggestions(vaultPath)
}
