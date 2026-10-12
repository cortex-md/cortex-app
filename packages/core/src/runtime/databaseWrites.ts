import type { DatabaseRow } from "@cortex/properties/database"

const configWrites = new Map<string, number>()
const cellWrites = new Map<string, Map<string, { value: unknown; count: number }>>()

export function beginDatabaseConfigWrite(folderPath: string): () => void {
	configWrites.set(folderPath, (configWrites.get(folderPath) ?? 0) + 1)
	let ended = false
	return () => {
		if (ended) return
		ended = true
		const next = (configWrites.get(folderPath) ?? 1) - 1
		if (next > 0) configWrites.set(folderPath, next)
		else configWrites.delete(folderPath)
	}
}

export function isDatabaseConfigWritePending(folderPath: string): boolean {
	return configWrites.has(folderPath)
}

export function beginDatabaseCellWrite(path: string, key: string, value: unknown): () => void {
	const patches = cellWrites.get(path) ?? new Map<string, { value: unknown; count: number }>()
	patches.set(key, { value, count: (patches.get(key)?.count ?? 0) + 1 })
	cellWrites.set(path, patches)
	return () => {
		const current = cellWrites.get(path)
		const patch = current?.get(key)
		if (!current || !patch) return
		if (patch.count > 1) patch.count--
		else current.delete(key)
		if (current.size === 0) cellWrites.delete(path)
	}
}

export function withPendingDatabaseCells(row: DatabaseRow): DatabaseRow {
	const patches = cellWrites.get(row.path)
	if (!patches) return row
	const meta = { ...row.meta }
	for (const [key, { value }] of patches) {
		if (value === undefined) delete meta[key]
		else meta[key] = value
	}
	return { ...row, meta }
}
