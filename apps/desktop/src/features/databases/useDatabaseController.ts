import {
	createDatabaseRow,
	flushDatabaseConfigWrites,
	reportAppError,
	retainDatabase,
	selectDatabaseByFolder,
	selectDatabaseRows,
	selectDatabaseRowsStatus,
	updateDatabaseConfig,
	useDatabaseStore,
	useVaultStore,
} from "@cortex/core"
import {
	createDatabaseView,
	type DatabaseGroup,
	type DatabaseRow,
	type DatabaseRowTemplate,
	type DatabaseView,
	type DatabaseViewType,
	getDatabaseRowPreset,
	getDatabaseViewColumns,
	queryDatabaseView,
	resolveDatabaseProperties,
} from "@cortex/properties/database"
import { useCallback, useDeferredValue, useEffect, useMemo } from "react"
import type { DatabaseViewState } from "./databaseWorkspace"
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
		(update: (view: DatabaseView) => DatabaseView) => {
			if (!activeView) return
			updateDatabaseConfig(folderPath, (current) => ({
				...current,
				views: current.views.map((view) => (view.id === activeView.id ? update(view) : view)),
			}))
		},
		[activeView, folderPath],
	)

	const addView = useCallback(
		(type: DatabaseViewType) => {
			const current = useDatabaseStore.getState().databases[folderPath]?.config
			if (!current) return
			const view = createDatabaseView(type, current.views, {
				group: type === "board" ? activeView?.group : undefined,
			})
			updateDatabaseConfig(folderPath, (next) => ({ ...next, views: [...next.views, view] }))
			patchState({ viewId: view.id })
		},
		[activeView?.group, folderPath, patchState],
	)

	const removeView = useCallback(
		(id: string) => {
			updateDatabaseConfig(folderPath, (current) =>
				current.views.length > 1
					? { ...current, views: current.views.filter((view) => view.id !== id) }
					: current,
			)
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
			if (!activeView) return
			try {
				const path = await createDatabaseRow(folderPath, {
					properties: {
						...(template?.properties ?? {}),
						...getDatabaseRowPreset(activeView, group, environment.queryContext, resolved),
						...extra,
					},
					body: template?.body,
				})
				patchState({ peekPath: path })
			} catch (error) {
				await reportAppError({
					operation: "database.create-row",
					source: "databases",
					cause: error,
					userMessage: "The note could not be created.",
					context: { folderPath },
				})
			}
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
			const titles = ordered.map((row) => row.title)
			const dragged = ordered.find((row) => row.path === draggedPath)?.title
			const target = ordered.find((row) => row.path === targetPath)?.title
			if (!dragged || !target) return
			const without = titles.filter((title) => title !== dragged)
			without.splice(without.indexOf(target), 0, dragged)
			updateView((view) => ({ ...view, order: without }))
		},
		[updateView],
	)

	const cycleSort = useCallback(
		(key: string) => {
			updateView((view) => {
				const current = view.sort?.[0]
				if (current?.key !== key) return { ...view, sort: [{ key, dir: "asc" }] }
				if (current.dir === "asc") return { ...view, sort: [{ key, dir: "desc" }] }
				return { ...view, sort: undefined }
			})
		},
		[updateView],
	)

	const renameDatabase = useCallback(
		async (name: string) => {
			await flushDatabaseConfigWrites()
			return useVaultStore.getState().renameFile(folderPath, name)
		},
		[folderPath],
	)

	const renameRow = useCallback(
		(path: string, name: string) => useVaultStore.getState().renameFile(path, `${name}.md`),
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
