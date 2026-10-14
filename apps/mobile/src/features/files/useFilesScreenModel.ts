import {
	type DatabaseEntry,
	formatLastSyncedAt,
	getFileTreeNodeTitle,
	useDatabaseStore,
	useVaultStore,
} from "@cortex/core"
import type { FileEntry } from "@cortex/platform"
import { getParentPath, isMarkdownPath, normalizePath } from "@cortex/platform/utils"
import type { DatabaseRow } from "@cortex/properties/database"
import { useMemo } from "react"

import { getNoteDetail } from "@/features/collab/collabAdapter"
import { useVaultDisplayName } from "@/features/file-explorer/vaultDisplayName"
import { type FilesSortOrder, useFilesSortOrder } from "@/features/files/filesSort"

export interface FilesDatabaseItem {
	kind: "database"
	entry: DatabaseEntry
	noteCount: number
	rows: DatabaseRow[]
	loading: boolean
}

export interface FilesFolderItem {
	kind: "folder"
	entry: FileEntry
	title: string
}

export interface FilesNoteItem {
	kind: "note"
	entry: FileEntry
	title: string
	detail: string
	pdf: boolean
}

export type FilesItem = FilesDatabaseItem | FilesFolderItem | FilesNoteItem

export interface FilesSection {
	key: "databases" | "folders" | "notes"
	title: string
	data: FilesItem[]
}

export const DATABASE_PREVIEW_ROWS = 5

function isHidden(entry: FileEntry): boolean {
	return entry.name.startsWith(".")
}

function compareEntries(order: FilesSortOrder) {
	return (left: FileEntry, right: FileEntry): number => {
		if (order === "edited") {
			const delta = (right.mtime ?? 0) - (left.mtime ?? 0)
			if (delta !== 0) return delta
		}
		return left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
	}
}

function isPdfPath(path: string): boolean {
	return path.toLowerCase().endsWith(".pdf")
}

function describeNote(entry: FileEntry): string {
	const live = getNoteDetail(entry.path)
	if (live) return live
	return entry.mtime ? `Edited ${formatLastSyncedAt(entry.mtime).toLowerCase()}` : "Note"
}

export function useFilesScreenModel(folderPath: string | null) {
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const databases = useDatabaseStore((state) => state.databases)
	const rowsByFolder = useDatabaseStore((state) => state.rowsByFolder)
	const sortOrder = useFilesSortOrder()
	const vaultName = useVaultDisplayName()
	const currentPath = normalizePath(folderPath ?? vault?.path ?? "")
	const isRoot = !folderPath || normalizePath(folderPath) === normalizePath(vault?.path ?? "")
	const title = isRoot
		? vaultName
		: getFileTreeNodeTitle({ name: currentPath.split("/").at(-1) ?? "", isDir: true })

	const sections = useMemo<FilesSection[]>(() => {
		const compare = compareEntries(sortOrder)
		const children = files.filter(
			(entry) => !isHidden(entry) && normalizePath(getParentPath(entry.path)) === currentPath,
		)
		const databaseItems: FilesDatabaseItem[] = []
		const folderItems: FilesFolderItem[] = []
		const noteItems: FilesNoteItem[] = []
		for (const entry of [...children].sort(compare)) {
			if (entry.isDir) {
				const database = databases[entry.path]
				if (database) {
					const rowsState = rowsByFolder[entry.path]
					const rows = Object.values(rowsState?.rows ?? {}).sort((a, b) => b.mtime - a.mtime)
					databaseItems.push({
						kind: "database",
						entry: database,
						noteCount: rows.length,
						rows,
						loading: rowsState?.status !== "ready",
					})
					continue
				}
				folderItems.push({ kind: "folder", entry, title: getFileTreeNodeTitle(entry) })
				continue
			}
			const pdf = isPdfPath(entry.path)
			if (!pdf && !isMarkdownPath(entry.path)) continue
			noteItems.push({
				kind: "note",
				entry,
				title: getFileTreeNodeTitle(entry),
				detail: describeNote(entry),
				pdf,
			})
		}
		const result: FilesSection[] = []
		if (databaseItems.length > 0) {
			result.push({ key: "databases", title: "Databases", data: databaseItems })
		}
		if (folderItems.length > 0) result.push({ key: "folders", title: "Folders", data: folderItems })
		if (noteItems.length > 0) result.push({ key: "notes", title: "Notes", data: noteItems })
		return result
	}, [currentPath, databases, files, rowsByFolder, sortOrder])

	const siblingNames = useMemo(
		() =>
			new Set(
				files
					.filter((entry) => normalizePath(getParentPath(entry.path)) === currentPath)
					.map((entry) => entry.name.toLocaleLowerCase()),
			),
		[currentPath, files],
	)

	return { currentPath, isRoot, sections, siblingNames, sortOrder, title, vault }
}
