import type { DatabasesRuntime } from "./types"

let databasesRuntime: DatabasesRuntime | null = null

export function initializeDatabases(runtime: DatabasesRuntime): void {
	databasesRuntime = runtime
}

export function getDatabasesRuntime(): DatabasesRuntime {
	if (!databasesRuntime) {
		throw new Error("Databases runtime not initialized. Call initializeDatabases() first.")
	}
	return databasesRuntime
}

export function getOptionalDatabasesRuntime(): DatabasesRuntime | null {
	return databasesRuntime
}

export function resetDatabasesRuntime(): void {
	databasesRuntime = null
}
