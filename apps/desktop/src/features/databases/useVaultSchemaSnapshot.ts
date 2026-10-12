import { useVaultStore } from "@cortex/core"
import { getVaultSchema, onVaultSchemaChange, type VaultSchema } from "@cortex/properties"
import { useCallback, useSyncExternalStore } from "react"

const EMPTY_SCHEMA: VaultSchema = { version: 1, properties: [] }

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
		entry = { schema: EMPTY_SCHEMA, listeners: new Set(), unsubscribe: null }
		entries.set(vaultPath, entry)
	}
	return entry
}

function subscribe(vaultPath: string | null, listener: () => void): () => void {
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

export function useVaultSchemaSnapshot(): VaultSchema {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const subscribeToVault = useCallback(
		(listener: () => void) => subscribe(vaultPath, listener),
		[vaultPath],
	)
	const getSnapshot = useCallback(
		() => (vaultPath ? getEntry(vaultPath).schema : EMPTY_SCHEMA),
		[vaultPath],
	)
	return useSyncExternalStore(subscribeToVault, getSnapshot)
}
