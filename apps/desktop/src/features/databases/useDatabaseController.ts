import type { DatabaseViewState } from "@cortex/core"
import {
	addDatabaseView,
	createDatabaseRowInView,
	cycleDatabaseViewSort,
	removeDatabaseView,
	renameDatabaseFolder,
	renameDatabaseRowNote,
	reorderDatabaseRowTitles,
	retainDatabase,
	selectDatabaseByFolder,
	selectDatabaseRows,
	selectDatabaseRowsStatus,
	updateDatabaseView,
	useDatabaseStore,
} from "@cortex/core"
import {
	type DatabaseGroup,
	type DatabaseRow,
	type DatabaseRowTemplate,
	type DatabaseView,
	type DatabaseViewType,
	getDatabaseViewColumns,
	queryDatabaseView,
	resolveDatabaseProperties,
} from "@cortex/properties/database"
import { useCallback, useDeferredValue, useEffect, useMemo } from "react"
import { useDatabaseEnvironment } from "./useDatabaseEnvironment"

export type PatchDatabaseViewState = (patch: Partial<DatabaseViewState>) => void

export function useDatabaseController(
	state: DatabaseViewState,
	patchState: PatchDatabaseViewState,
) {
	const folderPath = state.filePath
	const entry = useDatabaseStore(selectDatabaseByFolder(folderPath))
	const rowsRecord = useDatabaseStore(selectDatabaseRows(folderPath))
	const rowsStatus = useDatabaseStore(selectDatabaseRowsStatus(folderPath))
	const registryReady = useDatabaseStore((store) => store.registryReady)
	const environment = useDatabaseEnvironment()
	const deferredSearch = useDeferredValue(state.search)

	useEffect(() => retainDatabase(folderPath), [folderPath])

	const rows = useMemo(() => Object.values(rowsRecord), [rowsRecord])
	const config = entry?.config ?? null
	const activeView = config?.views.find((view) => view.id === state.viewId) ?? config?.views[0]
	const resolved = useMemo(
		() => resolveDatabaseProperties(environment.schema, rows, config),
		[environment.schema, rows, config],
	)
	const result = useMemo(
		() =>
			activeView
				? queryDatabaseView(rows, activeView, resolved, environment.queryContext, deferredSearch)
				: null,
		[activeView, rows, resolved, environment.queryContext, deferredSearch],
	)
	const columns = useMemo(
		() => (activeView ? getDatabaseViewColumns(activeView, resolved) : []),
		[activeView, resolved],
	)
	const collapsed = useMemo(() => new Set(state.collapsed), [state.collapsed])

	const updateView = useCallback(
		(update: (view: DatabaseView) => DatabaseView) =>
			updateDatabaseView(folderPath, activeView, update),
		[activeView, folderPath],
	)

	const addView = useCallback(
		(type: DatabaseViewType) => {
			const view = addDatabaseView(folderPath, type, activeView)
			if (!view) return
			patchState({ viewId: view.id })
		},
		[activeView, folderPath, patchState],
	)

	const removeView = useCallback(
		(id: string) => {
			removeDatabaseView(folderPath, id)
			patchState({ viewId: null })
		},
		[folderPath, patchState],
	)

	const createRow = useCallback(
		async (
			group: DatabaseGroup | null,
			template: DatabaseRowTemplate | null = null,
			extra: Record<string, unknown> = {},
		) => {
			const path = await createDatabaseRowInView(
				folderPath,
				activeView,
				group,
				template,
				extra,
				environment.queryContext,
				resolved,
			)
			if (path) patchState({ peekPath: path })
		},
		[activeView, environment.queryContext, folderPath, patchState, resolved],
	)

	const toggleGroup = useCallback(
		(key: string) => {
			patchState({
				collapsed: collapsed.has(key)
					? state.collapsed.filter((item) => item !== key)
					: [...state.collapsed, key],
			})
		},
		[collapsed, patchState, state.collapsed],
	)

	const reorderRows = useCallback(
		(ordered: readonly DatabaseRow[], draggedPath: string, targetPath: string) => {
			const without = reorderDatabaseRowTitles(ordered, draggedPath, targetPath)
			if (!without) return
			updateView((view) => ({ ...view, order: without }))
		},
		[updateView],
	)

	const cycleSort = useCallback(
		(key: string) => {
			updateView((view) => cycleDatabaseViewSort(view, key))
		},
		[updateView],
	)

	const renameDatabase = useCallback(
		(name: string) => renameDatabaseFolder(folderPath, name),
		[folderPath],
	)

	const renameRow = useCallback(
		(path: string, name: string) => renameDatabaseRowNote(path, name),
		[],
	)

	return {
		cycleSort,
		renameDatabase,
		renameRow,
		reorderRows,
		folderPath,
		entry,
		rowsRecord,
		rowsStatus,
		registryReady,
		environment,
		activeView,
		resolved,
		result,
		columns,
		collapsed,
		updateView,
		addView,
		removeView,
		createRow,
		toggleGroup,
	}
}

export type DatabaseController = ReturnType<typeof useDatabaseController>
