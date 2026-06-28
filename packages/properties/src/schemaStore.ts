import { validateVaultSchema } from "./definitions"
import { invalidatePropertySuggestions } from "./discovery/suggestions"
import { getPropertiesRuntime } from "./runtime"
import { getVaultSchema } from "./schemaPersistence"
import type { VaultSchema } from "./types"

export { getVaultSchema } from "./schemaPersistence"

type VaultSchemaChangeListener = () => void

const vaultSchemaChangeListeners = new Map<string, Set<VaultSchemaChangeListener>>()

export function notifyVaultSchemaChanged(vaultPath: string): void {
	invalidatePropertySuggestions(vaultPath)
	for (const listener of vaultSchemaChangeListeners.get(vaultPath) ?? []) listener()
}

export function onVaultSchemaChange(
	vaultPath: string,
	listener: VaultSchemaChangeListener,
): () => void {
	const listeners =
		vaultSchemaChangeListeners.get(vaultPath) ?? new Set<VaultSchemaChangeListener>()
	listeners.add(listener)
	vaultSchemaChangeListeners.set(vaultPath, listeners)
	return () => {
		listeners.delete(listener)
		if (listeners.size === 0) vaultSchemaChangeListeners.delete(vaultPath)
	}
}

export async function updateVaultSchema(vaultPath: string, schema: VaultSchema): Promise<void> {
	const runtime = getPropertiesRuntime()
	const validated = validateVaultSchema(schema)
	const current = await getVaultSchema(vaultPath)
	const currentKeys = new Map(current.properties.map((property) => [property.id, property.key]))
	for (const property of validated.properties) {
		const currentKey = currentKeys.get(property.id)
		if (currentKey && currentKey !== property.key) {
			throw new Error(`Property key "${currentKey}" is immutable`)
		}
	}
	await runtime.files.atomicWriteFile(
		`${vaultPath}/.cortex/schema/properties.json`,
		JSON.stringify(validated, null, "\t"),
	)
	notifyVaultSchemaChanged(vaultPath)
}
