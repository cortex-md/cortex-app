import type { DatabaseConfig, DatabaseRow } from "@cortex/properties/database"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

export interface DatabaseEntry {
	folderPath: string
	viewNotePath: string
	name: string
	config: DatabaseConfig
	configError: string | null
	description: string
}

export type DatabaseRowsStatus = "loading" | "ready"

export interface DatabaseRowsState {
	status: DatabaseRowsStatus
	rows: Record<string, DatabaseRow>
}

export interface DatabaseState {
	databases: Record<string, DatabaseEntry>
	viewNotePaths: string[]
	rowsByFolder: Record<string, DatabaseRowsState>
	registryReady: boolean

	setRegistryReady: (ready: boolean) => void
	setDatabase: (entry: DatabaseEntry) => void
	removeDatabase: (folderPath: string) => void
	setConfig: (folderPath: string, config: DatabaseConfig) => void
	setRowsStatus: (folderPath: string, status: DatabaseRowsStatus) => void
	upsertRows: (folderPath: string, rows: readonly DatabaseRow[]) => void
	removeRows: (folderPath: string, paths: readonly string[]) => void
	patchRowMeta: (folderPath: string, path: string, key: string, value: unknown) => void
	reset: () => void
}

const EMPTY_ROWS: Record<string, DatabaseRow> = {}

function collectViewNotePaths(databases: Record<string, DatabaseEntry>): string[] {
	return Object.values(databases)
		.map((entry) => entry.viewNotePath)
		.sort()
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((item, index) => item === right[index])
}

export const useDatabaseStore = create<DatabaseState>()(
	devtools(
		immer((set) => ({
			databases: {},
			viewNotePaths: [],
			rowsByFolder: {},
			registryReady: false,

			setRegistryReady: (ready) =>
				set((state) => {
					state.registryReady = ready
				}),

			setDatabase: (entry) =>
				set((state) => {
					state.databases[entry.folderPath] = entry
					const next = collectViewNotePaths(state.databases)
					if (!sameList(next, state.viewNotePaths)) state.viewNotePaths = next
				}),

			removeDatabase: (folderPath) =>
				set((state) => {
					if (!state.databases[folderPath]) return
					delete state.databases[folderPath]
					delete state.rowsByFolder[folderPath]
					state.viewNotePaths = collectViewNotePaths(state.databases)
				}),

			setConfig: (folderPath, config) =>
				set((state) => {
					const entry = state.databases[folderPath]
					if (!entry) return
					entry.config = config
					entry.configError = null
				}),

			setRowsStatus: (folderPath, status) =>
				set((state) => {
					const current = state.rowsByFolder[folderPath]
					if (current) current.status = status
					else state.rowsByFolder[folderPath] = { status, rows: {} }
				}),

			upsertRows: (folderPath, rows) =>
				set((state) => {
					if (rows.length === 0) return
					const current = state.rowsByFolder[folderPath] ?? { status: "loading", rows: {} }
					for (const row of rows) current.rows[row.path] = row
					state.rowsByFolder[folderPath] = current
				}),

			removeRows: (folderPath, paths) =>
				set((state) => {
					const current = state.rowsByFolder[folderPath]
					if (!current) return
					for (const path of paths) delete current.rows[path]
				}),

			patchRowMeta: (folderPath, path, key, value) =>
				set((state) => {
					const row = state.rowsByFolder[folderPath]?.rows[path]
					if (!row) return
					if (value === undefined) delete row.meta[key]
					else row.meta[key] = value
				}),

			reset: () =>
				set((state) => {
					state.databases = {}
					state.viewNotePaths = []
					state.rowsByFolder = {}
					state.registryReady = false
				}),
		})),
		{ name: "databaseStore" },
	),
)

export function selectDatabaseByFolder(folderPath: string) {
	return (state: DatabaseState): DatabaseEntry | null => state.databases[folderPath] ?? null
}

export function selectDatabaseRows(folderPath: string) {
	return (state: DatabaseState): Record<string, DatabaseRow> =>
		state.rowsByFolder[folderPath]?.rows ?? EMPTY_ROWS
}

export function selectDatabaseRowsStatus(folderPath: string) {
	return (state: DatabaseState): DatabaseRowsStatus =>
		state.rowsByFolder[folderPath]?.status ?? "loading"
}

export function selectViewNotePaths(state: DatabaseState): string[] {
	return state.viewNotePaths
}
