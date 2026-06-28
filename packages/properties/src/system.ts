import { resolveCurrentPropertyActor } from "./actors"
import { parseFrontmatter, setFrontmatterValue } from "./frontmatter"
import { getOptionalPropertiesRuntime } from "./runtime"
import { getVaultSchema } from "./schemaStore"
import type { PropertyDefinition, VaultSchema } from "./types"

function getSystemDefinition(schema: VaultSchema, type: string): PropertyDefinition | undefined {
	return schema.properties.find((property) => property.type === type)
}

async function applySystemValues(
	vaultPath: string,
	raw: string,
	options: {
		newNote: boolean
		duplicate: boolean
		updateEdited: boolean
	},
): Promise<string> {
	const runtime = getOptionalPropertiesRuntime()
	if (!runtime) return raw
	const schema = await getVaultSchema(vaultPath)
	if (schema.properties.length === 0) return raw
	const timestamp = (runtime.now?.() ?? new Date()).toISOString()
	let updated = raw
	const meta = parseFrontmatter(raw).meta
	const createdTime = getSystemDefinition(schema, "created_time")
	if (
		createdTime &&
		options.newNote &&
		(options.duplicate || meta[createdTime.key] === undefined)
	) {
		updated = setFrontmatterValue(updated, createdTime.key, timestamp)
	}
	if (options.updateEdited) {
		const editedTime = getSystemDefinition(schema, "last_edited_time")
		if (editedTime && Object.hasOwn(meta, editedTime.key)) {
			updated = setFrontmatterValue(updated, editedTime.key, timestamp)
		}
		const editedBy = getSystemDefinition(schema, "last_edited_by")
		if (editedBy && Object.hasOwn(meta, editedBy.key)) {
			const authorContext = await runtime.identity.getAuthorContext(vaultPath)
			updated = setFrontmatterValue(
				updated,
				editedBy.key,
				resolveCurrentPropertyActor(authorContext),
			)
		}
	}
	return updated
}

export async function createNoteWithPropertyDefaults(
	vaultPath: string,
	body = "",
): Promise<string> {
	return applySystemValues(vaultPath, body, {
		newNote: true,
		duplicate: false,
		updateEdited: false,
	})
}

export async function prepareDuplicatedNote(vaultPath: string, raw: string): Promise<string> {
	return applySystemValues(vaultPath, raw, {
		newNote: true,
		duplicate: true,
		updateEdited: false,
	})
}

export async function prepareNoteForSave(filePath: string, raw: string): Promise<string> {
	const runtime = getOptionalPropertiesRuntime()
	if (!runtime) return raw
	const vaultPath = runtime.notes.resolveVaultPath(filePath)
	if (!vaultPath) return raw
	return applySystemValues(vaultPath, raw, {
		newNote: false,
		duplicate: false,
		updateEdited: true,
	})
}
