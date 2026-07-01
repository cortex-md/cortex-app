import { useDatabaseStore, useVaultStore } from "@cortex/core"
import type { DatabaseLayout } from "@cortex/databases"
import { serializeDatabaseEmbedMarker } from "@cortex/databases"
import type { EditorRuntimeView } from "@cortex/editor/types"
import { getEditorViewRef } from "@cortex/plugin-host-core"

export interface CreateInlineDatabaseOptions {
	name?: string
	layout?: DatabaseLayout
}

function needsLeadingBreak(view: EditorRuntimeView, from: number): boolean {
	if (from === 0) return false
	const previous = view.state.sliceDoc(Math.max(0, from - 1), from)
	return previous !== "\n"
}

function needsTrailingBreak(view: EditorRuntimeView, to: number): boolean {
	if (to >= view.state.doc.length) return false
	const next = view.state.sliceDoc(to, Math.min(view.state.doc.length, to + 1))
	return next !== "\n"
}

function getRelativePath(vaultPath: string, filePath: string): string {
	return filePath.startsWith(`${vaultPath}/`) ? filePath.slice(vaultPath.length + 1) : filePath
}

function getDefaultFolder(vaultPath: string, filePath: string | null): string {
	if (!filePath || !filePath.startsWith(`${vaultPath}/`)) return ""
	const relativePath = getRelativePath(vaultPath, filePath)
	return relativePath.includes("/") ? relativePath.split("/").slice(0, -1).join("/") : ""
}

export function insertDatabaseEmbedMarker(
	view: EditorRuntimeView,
	databaseId: string,
	viewId: string,
): boolean {
	const marker = serializeDatabaseEmbedMarker({ databaseId, viewId })
	const { from, to } = view.state.selection.main
	const leadingBreak = needsLeadingBreak(view, from) ? "\n\n" : ""
	const trailingBreak = needsTrailingBreak(view, to) ? "\n\n" : "\n"
	const insertion = `${leadingBreak}${marker}${trailingBreak}`
	view.dispatch({
		changes: { from, to, insert: insertion },
		selection: { anchor: from + insertion.length },
	})
	return true
}

export function insertDatabaseEmbedAtActiveSelection(databaseId: string, viewId: string): boolean {
	const view = getEditorViewRef() as EditorRuntimeView | null
	return view ? insertDatabaseEmbedMarker(view, databaseId, viewId) : false
}

export async function createInlineDatabaseAtActiveSelection(
	filePath: string | null,
	options: CreateInlineDatabaseOptions = {},
): Promise<boolean> {
	const view = getEditorViewRef() as EditorRuntimeView | null
	if (!view) return false
	return createInlineDatabaseAtSelection(view, filePath, options)
}

export async function createInlineDatabaseAtSelection(
	view: EditorRuntimeView,
	filePath: string | null,
	options: CreateInlineDatabaseOptions = {},
): Promise<boolean> {
	const vaultPath = useVaultStore.getState().vault?.path
	if (!vaultPath || !filePath) return false
	const layout = options.layout ?? "table"
	const databaseStore = useDatabaseStore.getState()
	const statusProperty =
		layout === "board" ? await databaseStore.ensureBoardStatusProperty(vaultPath) : null
	const entry = await databaseStore.createDatabase(vaultPath, {
		name: options.name?.trim() || "Database",
		layout,
		defaultFolder: getDefaultFolder(vaultPath, filePath),
		createdInNotePath: getRelativePath(vaultPath, filePath),
		propertyKeys: statusProperty ? [statusProperty.key] : [],
		visiblePropertyKeys: statusProperty ? [statusProperty.key] : [],
		groupByPropertyKey: statusProperty?.key,
	})
	insertDatabaseEmbedMarker(view, entry.database.id, entry.view.id)
	return true
}
