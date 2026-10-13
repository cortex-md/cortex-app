import { executeCommand } from "@cortex/commands"
import {
	createFileTreeViewModel,
	type FileEntryAction,
	getEditableEntryName,
	getErrorMessage,
	getMoveDestinations,
	toEntryFileName,
	useVaultStore,
	validateEntryName,
} from "@cortex/core"
import type { FileEntry } from "@cortex/platform"
import type { PluginContextMenuAction } from "@cortex/plugin-host-core"
import { useMemo } from "react"

import { openMobileNote } from "@/bootstrap/appCommands"
import { getTextActionNameKind } from "@/features/file-explorer/TextActionSheet"
import { runSubmittingTask, type SidebarUi } from "@/features/sidebar/sidebarUiState"
import { triggerDeleteHaptic, triggerSelectionHaptic } from "@/utils/haptics"

export function useFileExplorerActions({ closeSidebar, dispatchUi, uiState }: SidebarUi) {
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const createFile = useVaultStore((state) => state.createFile)
	const createFolder = useVaultStore((state) => state.createFolder)
	const moveFile = useVaultStore((state) => state.moveFile)
	const refreshFiles = useVaultStore((state) => state.refreshFiles)
	const renameFile = useVaultStore((state) => state.renameFile)
	const vaultPath = vault?.path ?? null
	const treeView = useMemo(
		() => createFileTreeViewModel(files, vaultPath, uiState.expandedFolders),
		[files, vaultPath, uiState.expandedFolders],
	)
	const moveDestinations = getMoveDestinations(files, uiState.moveEntry, vault)
	const textInitialValue =
		uiState.textAction?.kind === "rename" ? getEditableEntryName(uiState.textAction.entry) : ""

	function handleOpenNote(filePath: string) {
		openMobileNote(filePath)
		closeSidebar()
	}

	function handleToggleFolder(folderPath: string) {
		triggerSelectionHaptic()
		dispatchUi({ path: folderPath, type: "toggle-folder" })
	}

	function handleRefresh() {
		void refreshFiles()
	}

	function handleExpandCollapseAll() {
		triggerSelectionHaptic()
		dispatchUi({
			folders: treeView.allExpanded ? new Set() : new Set(treeView.folderPaths),
			type: "set-expanded-folders",
		})
	}

	function handleOpenEntryActions(entry: FileEntry) {
		triggerSelectionHaptic()
		dispatchUi({ entry, type: "set-entry-actions-entry" })
	}

	function handleEntryAction(entry: FileEntry, action: FileEntryAction) {
		dispatchUi({ entry: null, type: "set-entry-actions-entry" })
		switch (action.id) {
			case "rename":
				dispatchUi({ action: { entry, kind: "rename" }, type: "set-text-action" })
				return
			case "move":
				dispatchUi({ entry, type: "set-move-entry" })
				return
			case "delete":
				triggerDeleteHaptic()
				break
			case "duplicate":
				triggerSelectionHaptic()
				closeSidebar()
				break
		}
		executeCommand(action.commandId, { payload: action.payload, source: "menu" })
	}

	function handlePluginEntryAction(action: PluginContextMenuAction) {
		dispatchUi({ entry: null, type: "set-entry-actions-entry" })
		triggerSelectionHaptic()
		action.run()
	}

	async function handleSubmitTextAction(value: string) {
		const action = uiState.textAction
		if (!action) return

		const nameKind = getTextActionNameKind(action)
		const validationError = validateEntryName(nameKind, value)
		if (validationError) {
			dispatchUi({ error: validationError, type: "set-text-error" })
			return
		}

		dispatchUi({ error: null, type: "set-text-error" })
		await runSubmittingTask(
			dispatchUi,
			async () => {
				switch (action.kind) {
					case "create-note":
						handleOpenNote(await createFile(action.parentPath, value))
						break
					case "create-folder":
						await createFolder(action.parentPath, value)
						break
					case "rename":
						await renameFile(action.entry.path, toEntryFileName(nameKind, value))
						break
				}
				dispatchUi({ action: null, type: "set-text-action" })
			},
			(error) => dispatchUi({ error: getErrorMessage(error), type: "set-text-error" }),
		)
	}

	async function handleMoveEntry(targetParentPath: string) {
		const entry = uiState.moveEntry
		if (!entry) return
		triggerSelectionHaptic()
		dispatchUi({ error: null, type: "set-move-error" })
		await runSubmittingTask(
			dispatchUi,
			async () => {
				await moveFile(entry.path, targetParentPath)
				dispatchUi({ entry: null, type: "set-move-entry" })
			},
			(error) => dispatchUi({ error: getErrorMessage(error), type: "set-move-error" }),
		)
	}

	function openCreateNoteSheet() {
		if (!vault) return
		triggerSelectionHaptic()
		dispatchUi({ action: { kind: "create-note", parentPath: vault.path }, type: "set-text-action" })
	}

	function openCreateFolderSheet() {
		if (!vault) return
		triggerSelectionHaptic()
		dispatchUi({
			action: { kind: "create-folder", parentPath: vault.path },
			type: "set-text-action",
		})
	}

	return {
		handleEntryAction,
		handleExpandCollapseAll,
		handleMoveEntry,
		handleOpenEntryActions,
		handleOpenNote,
		handlePluginEntryAction,
		handleRefresh,
		handleSubmitTextAction,
		handleToggleFolder,
		moveDestinations,
		openCreateFolderSheet,
		openCreateNoteSheet,
		textInitialValue,
		treeView,
	}
}
