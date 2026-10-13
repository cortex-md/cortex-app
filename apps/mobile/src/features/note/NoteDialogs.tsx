import { getErrorMessage, toEntryFileName, useVaultStore, validateEntryName } from "@cortex/core"
import { getBaseName, getParentPath } from "@cortex/platform/utils"
import { router } from "expo-router"
import { useState } from "react"

import { TextPromptDialog } from "@/components/ui/TextPromptDialog"
import { DeleteEntryDialog } from "@/features/files/DeleteEntryDialog"

export type NoteDialog = "none" | "rename" | "delete"

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

export function NoteDialogs({
	dialog,
	filePath,
	onClose,
	title,
}: {
	dialog: NoteDialog
	filePath: string | null
	onClose: () => void
	title: string
}) {
	const renameFile = useVaultStore((state) => state.renameFile)
	const [renameError, setRenameError] = useState<string | null>(null)

	function close() {
		setRenameError(null)
		onClose()
	}

	async function handleRename(value: string) {
		if (!filePath) return
		const fileName = toEntryFileName("note", value)
		const error = validateEntryName("note", value) ?? duplicateNoteError(filePath, fileName, value)
		if (error) {
			setRenameError(error)
			return
		}
		try {
			const nextPath = await renameFile(filePath, fileName)
			close()
			router.setParams({ filePath: nextPath })
		} catch (renameFailure) {
			setRenameError(getErrorMessage(renameFailure))
		}
	}

	return (
		<>
			{dialog === "rename" ? (
				<TextPromptDialog
					confirmLabel="Rename"
					error={renameError}
					initialValue={title}
					onCancel={close}
					onChangeText={() => setRenameError(null)}
					onConfirm={(value) => void handleRename(value)}
					placeholder="Name"
					title="Rename note"
					visible
				/>
			) : null}
			<DeleteEntryDialog
				filePath={dialog === "delete" ? filePath : null}
				onDeleted={() => {
					if (router.canGoBack()) router.back()
				}}
				onDismiss={close}
			/>
		</>
	)
}
