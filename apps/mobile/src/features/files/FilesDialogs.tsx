import { executeCommand } from "@cortex/commands"
import {
	type FileEntryAction,
	getEditableEntryName,
	getEntryNameKind,
	getErrorMessage,
	getMoveDestinations,
	toEntryFileName,
	useVaultStore,
	validateEntryName,
} from "@cortex/core"
import type { FileEntry, VaultMetadata } from "@cortex/platform"
import type { PluginContextMenuAction } from "@cortex/plugin-host-core"
import { useState } from "react"

import { TextPromptDialog } from "@/components/ui/TextPromptDialog"
import { EntryActionsSheet } from "@/features/file-explorer/EntryActionsSheet"
import { MoveEntrySheet } from "@/features/file-explorer/MoveEntrySheet"
import { DeleteEntryDialog } from "@/features/files/DeleteEntryDialog"
import { NewFolderDialog } from "@/features/files/NewFolderDialog"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

export type FilesDialogState =
	| { kind: "none" }
	| { kind: "new-folder" }
	| { kind: "actions"; entry: FileEntry }
	| { kind: "rename"; entry: FileEntry }
	| { kind: "delete"; entry: FileEntry }
	| { kind: "move"; entry: FileEntry }

export const NO_FILES_DIALOG: FilesDialogState = { kind: "none" }

function entryOf(dialog: FilesDialogState, kind: FilesDialogState["kind"]): FileEntry | null {
	return dialog.kind === kind && "entry" in dialog ? dialog.entry : null
}

export function FilesDialogs({
	currentPath,
	dialog,
	locationLabel,
	onChange,
	siblingNames,
	vault,
}: {
	currentPath: string
	dialog: FilesDialogState
	locationLabel: string
	onChange: (next: FilesDialogState) => void
	siblingNames: ReadonlySet<string>
	vault: VaultMetadata | null
}) {
	const { colors } = useMobileColors()
	const files = useVaultStore((state) => state.files)
	const renameFile = useVaultStore((state) => state.renameFile)
	const moveFile = useVaultStore((state) => state.moveFile)
	const [error, setError] = useState<string | null>(null)
	const renameEntry = entryOf(dialog, "rename")
	const moveEntry = entryOf(dialog, "move")
	const deleteEntry = entryOf(dialog, "delete")

	function close() {
		onChange(NO_FILES_DIALOG)
		setError(null)
	}

	function handleEntryAction(entry: FileEntry, action: FileEntryAction) {
		if (action.id === "duplicate") {
			close()
			triggerSelectionHaptic()
			executeCommand(action.commandId, { payload: action.payload, source: "menu" })
			return
		}
		onChange({ kind: action.id, entry })
	}

	function handlePluginAction(action: PluginContextMenuAction) {
		close()
		action.run()
	}

	async function handleRename(entry: FileEntry, value: string) {
		const kind = getEntryNameKind(entry)
		const validationError = validateEntryName(kind, value)
		if (validationError) {
			setError(validationError)
			return
		}
		try {
			await renameFile(entry.path, toEntryFileName(kind, value))
			close()
		} catch (renameError) {
			setError(getErrorMessage(renameError))
		}
	}

	async function handleMove(entry: FileEntry, targetParentPath: string) {
		try {
			await moveFile(entry.path, targetParentPath)
			close()
		} catch (moveError) {
			setError(getErrorMessage(moveError))
		}
	}

	return (
		<>
			<EntryActionsSheet
				entry={entryOf(dialog, "actions")}
				onAction={handleEntryAction}
				onDismiss={close}
				onPluginAction={handlePluginAction}
				submitting={false}
			/>
			<NewFolderDialog
				locationLabel={locationLabel}
				onDismiss={close}
				parentPath={currentPath}
				siblingNames={siblingNames}
				visible={dialog.kind === "new-folder"}
			/>
			{renameEntry ? (
				<TextPromptDialog
					confirmLabel="Rename"
					error={error}
					initialValue={getEditableEntryName(renameEntry)}
					message={renameEntry.path.replace(`${vault?.path ?? ""}/`, "")}
					onCancel={close}
					onChangeText={() => setError(null)}
					onConfirm={(value) => void handleRename(renameEntry, value)}
					placeholder={renameEntry.isDir ? "Folder name" : "Name"}
					title={renameEntry.isDir ? "Rename folder" : "Rename note"}
					visible
				/>
			) : null}
			<DeleteEntryDialog
				filePath={deleteEntry?.path ?? null}
				isDirectory={deleteEntry?.isDir ?? false}
				onDismiss={close}
			/>
			<MoveEntrySheet
				destinations={moveEntry ? getMoveDestinations(files, moveEntry, vault) : []}
				entry={moveEntry}
				error={error}
				onDismiss={close}
				onMove={(targetParentPath) => {
					if (moveEntry) void handleMove(moveEntry, targetParentPath)
				}}
				submitting={false}
				textColor={colors.label}
			/>
		</>
	)
}
