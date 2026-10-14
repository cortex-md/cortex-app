import { getErrorMessage, toEntryFileName, useVaultStore, validateEntryName } from "@cortex/core"
import { getBaseName, getParentPath } from "@cortex/platform/utils"

import { renameVaultEntry } from "@/features/file-explorer/entryActions"

export type NoteRenameResult = { path: string } | { error: string }

function duplicateNoteError(filePath: string, fileName: string, title: string): string | null {
	const { files, vault } = useVaultStore.getState()
	const parent = getParentPath(filePath)
	const taken = files.some(
		(entry) =>
			entry.path !== filePath &&
			getParentPath(entry.path) === parent &&
			entry.name.toLocaleLowerCase() === fileName.toLocaleLowerCase(),
	)
	if (!taken) return null
	return `A note named ${title} already exists in ${getBaseName(parent) || vault?.name || "this folder"}.`
}

export async function renameNote(filePath: string, value: string): Promise<NoteRenameResult> {
	const title = value.trim()
	const fileName = toEntryFileName("note", title)
	if (fileName === getBaseName(filePath)) return { path: filePath }
	const error = validateEntryName("note", title) ?? duplicateNoteError(filePath, fileName, title)
	if (error) return { error }
	try {
		return { path: await renameVaultEntry(filePath, fileName) }
	} catch (renameError) {
		return { error: getErrorMessage(renameError) }
	}
}
