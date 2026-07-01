import { useSyncExternalStore } from "react"

export type DatabaseDialogMode = "create" | "open" | "embed" | "create-view"

const listeners = new Set<() => void>()
let databaseDialogMode: DatabaseDialogMode | null = null

function emitDatabaseDialogChange(): void {
	for (const listener of listeners) listener()
}

function subscribeDatabaseDialog(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getDatabaseDialogSnapshot(): DatabaseDialogMode | null {
	return databaseDialogMode
}

export function openDatabaseDialog(mode: DatabaseDialogMode): void {
	databaseDialogMode = mode
	emitDatabaseDialogChange()
}

export function closeDatabaseDialog(): void {
	if (!databaseDialogMode) return
	databaseDialogMode = null
	emitDatabaseDialogChange()
}

export function useDatabaseDialogMode(): DatabaseDialogMode | null {
	return useSyncExternalStore(
		subscribeDatabaseDialog,
		getDatabaseDialogSnapshot,
		getDatabaseDialogSnapshot,
	)
}
