import {
	createDatabaseView,
	type DatabaseGroup,
	type DatabaseQueryContext,
	type DatabaseRow,
	type DatabaseRowTemplate,
	type DatabaseView,
	type DatabaseViewType,
	getDatabaseRowPreset,
	type ResolvedDatabaseProperties,
} from "@cortex/properties/database"
import { useDatabaseStore } from "../stores/databaseStore"
import { useVaultStore } from "../stores/vaultStore"
import { reportAppError } from "../utils/reportAppError"
import {
	createDatabaseRow,
	flushDatabaseConfigWrites,
	updateDatabaseConfig,
} from "./databaseActions"

export function updateDatabaseView(
	folderPath: string,
	activeView: DatabaseView | undefined,
	update: (view: DatabaseView) => DatabaseView,
): void {
	if (!activeView) return
	updateDatabaseConfig(folderPath, (current) => ({
		...current,
		views: current.views.map((view) => (view.id === activeView.id ? update(view) : view)),
	}))
}

export function addDatabaseView(
	folderPath: string,
	type: DatabaseViewType,
	activeView: DatabaseView | undefined,
): DatabaseView | null {
	const current = useDatabaseStore.getState().databases[folderPath]?.config
	if (!current) return null
	const view = createDatabaseView(type, current.views, {
		group: type === "board" ? activeView?.group : undefined,
	})
	updateDatabaseConfig(folderPath, (next) => ({ ...next, views: [...next.views, view] }))
	return view
}

export function removeDatabaseView(folderPath: string, id: string): void {
	updateDatabaseConfig(folderPath, (current) =>
		current.views.length > 1
			? { ...current, views: current.views.filter((view) => view.id !== id) }
			: current,
	)
}

export async function createDatabaseRowInView(
	folderPath: string,
	activeView: DatabaseView | undefined,
	group: DatabaseGroup | null,
	template: DatabaseRowTemplate | null,
	extra: Record<string, unknown>,
	queryContext: DatabaseQueryContext,
	resolved: ResolvedDatabaseProperties,
): Promise<string | null> {
	if (!activeView) return null
	try {
		return await createDatabaseRow(folderPath, {
			properties: {
				...(template?.properties ?? {}),
				...getDatabaseRowPreset(activeView, group, queryContext, resolved),
				...extra,
			},
			body: template?.body,
		})
	} catch (error) {
		await reportAppError({
			operation: "database.create-row",
			source: "databases",
			cause: error,
			userMessage: "The note could not be created.",
			context: { folderPath },
		})
		return null
	}
}

export function reorderDatabaseRowTitles(
	ordered: readonly DatabaseRow[],
	draggedPath: string,
	targetPath: string,
): string[] | null {
	const titles = ordered.map((row) => row.title)
	const dragged = ordered.find((row) => row.path === draggedPath)?.title
	const target = ordered.find((row) => row.path === targetPath)?.title
	if (!dragged || !target) return null
	const without = titles.filter((title) => title !== dragged)
	without.splice(without.indexOf(target), 0, dragged)
	return without
}

export function cycleDatabaseViewSort(view: DatabaseView, key: string): DatabaseView {
	const current = view.sort?.[0]
	if (current?.key !== key) return { ...view, sort: [{ key, dir: "asc" }] }
	if (current.dir === "asc") return { ...view, sort: [{ key, dir: "desc" }] }
	return { ...view, sort: undefined }
}

export async function renameDatabaseFolder(folderPath: string, name: string): Promise<string> {
	await flushDatabaseConfigWrites()
	return useVaultStore.getState().renameFile(folderPath, name)
}

export function renameDatabaseRowNote(path: string, name: string): Promise<string> {
	return useVaultStore.getState().renameFile(path, `${name}.md`)
}
