import {
	addDatabaseView,
	createDatabaseRow,
	cycleDatabaseViewSort,
	getDatabaseQueryContext,
	getErrorMessage,
	retainDatabase,
	selectDatabaseByFolder,
	selectDatabaseRows,
	selectDatabaseRowsStatus,
	updateDatabaseView,
	useDatabaseStore,
	useVaultStore,
} from "@cortex/core"
import {
	getPropertiesRuntime,
	getVaultSchemaSnapshot,
	type ResolvedAuthorConfig,
	resolveAuthorConfig,
	subscribeVaultSchemaSnapshot,
	type VaultSchema,
} from "@cortex/properties"
import {
	type DatabaseGroup,
	type DatabaseQueryContext,
	type DatabaseView,
	type DatabaseViewType,
	getDatabaseRowPreset,
	getDatabaseViewColumns,
	queryDatabaseView,
	resolveDatabaseProperties,
	toIsoDate,
} from "@cortex/properties/database"
import { useCallback, useDeferredValue, useEffect, useMemo, useState, useSyncExternalStore } from "react"

import type { DatabaseRowTemplateChoice } from "@/features/database/databaseAdapter"
import { resolveDatabaseRoles } from "@/features/database/databaseFormat"
import { toast } from "@/features/feedback/useToast"

const TEXT_AUTHOR: ResolvedAuthorConfig = { variant: "text" }

interface DatabaseIdentity {
	authorConfig: ResolvedAuthorConfig
	currentUserId: string | null
}

const anonymousIdentity: DatabaseIdentity = { authorConfig: TEXT_AUTHOR, currentUserId: null }

function useVaultSchema(vaultPath: string | null): VaultSchema {
	const subscribe = useCallback(
		(listener: () => void) => subscribeVaultSchemaSnapshot(vaultPath, listener),
		[vaultPath],
	)
	const getSnapshot = useCallback(() => getVaultSchemaSnapshot(vaultPath), [vaultPath])
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

async function loadIdentity(vaultPath: string): Promise<DatabaseIdentity> {
	const [authorContext, context] = await Promise.all([
		getPropertiesRuntime().identity.getAuthorContext(vaultPath),
		getDatabaseQueryContext(),
	])
	return { authorConfig: resolveAuthorConfig(authorContext), currentUserId: context.currentUserId }
}

function useDatabaseIdentity(vaultPath: string | null): DatabaseIdentity {
	const [identity, setIdentity] = useState<{ path: string; value: DatabaseIdentity } | null>(null)

	useEffect(() => {
		if (!vaultPath) return
		let cancelled = false
		void loadIdentity(vaultPath).then(
			(value) => {
				if (!cancelled) setIdentity({ path: vaultPath, value })
			},
			() => undefined,
		)
		return () => {
			cancelled = true
		}
	}, [vaultPath])

	return identity && identity.path === vaultPath ? identity.value : anonymousIdentity
}

export interface CreatedDatabaseRow {
	path: string
	title: string
}

async function writeDatabaseRow(
	folderPath: string,
	title: string,
	properties: Record<string, unknown>,
	body: string | undefined,
): Promise<CreatedDatabaseRow | null> {
	try {
		const path = await createDatabaseRow(folderPath, { body, properties, title })
		return { path, title }
	} catch (error) {
		toast(getErrorMessage(error))
		return null
	}
}

export function useDatabaseView(folderPath: string, requestedViewId?: string, search = "") {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const entry = useDatabaseStore(selectDatabaseByFolder(folderPath))
	const rowsRecord = useDatabaseStore(selectDatabaseRows(folderPath))
	const rowsStatus = useDatabaseStore(selectDatabaseRowsStatus(folderPath))
	const registryReady = useDatabaseStore((state) => state.registryReady)
	const schema = useVaultSchema(vaultPath)
	const identity = useDatabaseIdentity(vaultPath)
	const [today] = useState(() => toIsoDate(new Date()))
	const [viewId, setViewId] = useState<string | undefined>(requestedViewId)
	const deferredSearch = useDeferredValue(search)

	useEffect(() => retainDatabase(folderPath), [folderPath])

	const queryContext = useMemo<DatabaseQueryContext>(
		() => ({ currentUserId: identity.currentUserId, today }),
		[identity.currentUserId, today],
	)
	const rows = useMemo(() => Object.values(rowsRecord), [rowsRecord])
	const config = entry?.config ?? null
	const activeView = config?.views.find((view) => view.id === viewId) ?? config?.views[0]
	const resolved = useMemo(
		() => resolveDatabaseProperties(schema, rows, config),
		[schema, rows, config],
	)
	const result = useMemo(
		() =>
			activeView
				? queryDatabaseView(rows, activeView, resolved, queryContext, deferredSearch)
				: null,
		[activeView, rows, resolved, queryContext, deferredSearch],
	)
	const columns = useMemo(
		() => (activeView ? getDatabaseViewColumns(activeView, resolved) : []),
		[activeView, resolved],
	)
	const roles = useMemo(() => resolveDatabaseRoles(activeView, resolved), [activeView, resolved])

	const updateView = useCallback(
		(update: (view: DatabaseView) => DatabaseView) =>
			updateDatabaseView(folderPath, activeView, update),
		[activeView, folderPath],
	)

	const selectViewType = useCallback(
		(type: DatabaseViewType) => {
			const existing = config?.views.find((view) => view.type === type)
			if (existing) {
				setViewId(existing.id)
				return
			}
			const created = addDatabaseView(folderPath, type, activeView)
			if (!created) return
			if (type === "calendar" && roles.dateKey) {
				updateDatabaseView(folderPath, created, (view) => ({ ...view, date: roles.dateKey }))
			}
			setViewId(created.id)
		},
		[activeView, config, folderPath, roles.dateKey],
	)

	const cycleSort = useCallback(
		(key: string) => updateView((view) => cycleDatabaseViewSort(view, key)),
		[updateView],
	)

	const createRow = useCallback(
		(group: DatabaseGroup | null, template?: DatabaseRowTemplateChoice) => {
			const preset = activeView
				? getDatabaseRowPreset(activeView, group, queryContext, resolved)
				: {}
			return writeDatabaseRow(
				folderPath,
				template?.title ?? "Untitled",
				{ ...(template?.properties ?? {}), ...preset },
				template?.body,
			)
		},
		[activeView, folderPath, queryContext, resolved],
	)

	return {
		activeView,
		authorConfig: identity.authorConfig,
		columns,
		config,
		createRow,
		cycleSort,
		entry,
		folderPath,
		loading: !registryReady || (Boolean(entry) && rowsStatus === "loading" && rows.length === 0),
		queryContext,
		registryReady,
		resolved,
		result,
		roles,
		rows,
		selectViewType,
		updateView,
	}
}

export type DatabaseViewModel = ReturnType<typeof useDatabaseView>
