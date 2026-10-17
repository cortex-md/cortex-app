import { getVaultSchema } from "./schemaPersistence"
import { onVaultSchemaChange, updateVaultSchema } from "./schemaStore"
import type { PropertyDefinition, VaultSchema } from "./types"

export const EMPTY_VAULT_SCHEMA: VaultSchema = { version: 1, properties: [] }

interface SchemaEntry {
	schema: VaultSchema
	listeners: Set<() => void>
	unsubscribe: (() => void) | null
}

const entries = new Map<string, SchemaEntry>()

function load(vaultPath: string, entry: SchemaEntry) {
	void getVaultSchema(vaultPath).then((schema) => {
		if (JSON.stringify(schema) === JSON.stringify(entry.schema)) return
		entry.schema = schema
		for (const listener of entry.listeners) listener()
	})
}

function getEntry(vaultPath: string): SchemaEntry {
	let entry = entries.get(vaultPath)
	if (!entry) {
		entry = { schema: EMPTY_VAULT_SCHEMA, listeners: new Set(), unsubscribe: null }
		entries.set(vaultPath, entry)
	}
	return entry
}

export function subscribeVaultSchemaSnapshot(
	vaultPath: string | null,
	listener: () => void,
): () => void {
	if (!vaultPath) return () => {}
	const entry = getEntry(vaultPath)
	entry.listeners.add(listener)
	if (!entry.unsubscribe) {
		const current = entry
		current.unsubscribe = onVaultSchemaChange(vaultPath, () => load(vaultPath, current))
		load(vaultPath, current)
	}
	return () => {
		entry.listeners.delete(listener)
		if (entry.listeners.size > 0) return
		entry.unsubscribe?.()
		entry.unsubscribe = null
	}
}

export function setVaultSchemaSnapshot(vaultPath: string, schema: VaultSchema): void {
	const entry = getEntry(vaultPath)
	entry.schema = schema
	for (const listener of entry.listeners) listener()
}

export function getVaultSchemaSnapshot(vaultPath: string | null): VaultSchema {
	return vaultPath ? getEntry(vaultPath).schema : EMPTY_VAULT_SCHEMA
}

export async function upsertVaultSchemaDefinition(
	vaultPath: string,
	definition: PropertyDefinition,
): Promise<void> {
	const current = await getVaultSchema(vaultPath)
	const exists = current.properties.some((item) => item.id === definition.id)
	const next: VaultSchema = {
		version: 1,
		properties: exists
			? current.properties.map((item) => (item.id === definition.id ? definition : item))
			: [...current.properties, { ...definition, observed: undefined }],
	}
	await updateVaultSchema(vaultPath, next)
	setVaultSchemaSnapshot(vaultPath, next)
}
