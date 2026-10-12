import { executeCommand } from "@cortex/commands"
import {
	canWriteVaultPath,
	FILE_COMMAND_IDS,
	type FileTreeNode,
	reportAppError,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { FilePlusIcon, FolderPlusIcon } from "lucide-react"
import { type RefObject, useMemo, useReducer } from "react"
import type { MenuPosition } from "@/utils/context-menu"
import { openDatabaseView } from "../databases/databaseWorkspace"
import { FILE_EXPLORER_COMMAND_IDS, type FileExplorerCommandId } from "./fileExplorerCommands"
import { buildFileMenuItems } from "./fileMenu"
import { getFileTreeItemId, getKeyboardMenuPosition } from "./fileTreeDom"

export type FileCreateType = "file" | "folder"

export type FileOpenMode = "reuse-active" | "new-tab"

export interface FileSidebarUiState {
	renamingPath: string | null
	creatingIn: string | null
	creatingType: FileCreateType | null
}

type FileSidebarUiAction =
	| { type: "startCreate"; parentPath: string; createType: FileCreateType }
	| { type: "cancelCreate" }
	| { type: "startRename"; path: string }
	| { type: "cancelRename" }

export interface FileTreeActions {
	openFile: (path: string, mode: FileOpenMode) => void
	openDatabase: (path: string, mode: FileOpenMode) => void
	toggle: (path: string) => void
	ensureExpanded: (path: string) => void
	focusPath: (path: string) => void
	startCreate: (parentPath: string, createType: FileCreateType) => void
	confirmCreate: (parentPath: string, name: string, createType: FileCreateType) => Promise<void>
	cancelCreate: () => void
	startRename: (path: string) => void
	confirmRename: (oldPath: string, newName: string) => Promise<void>
	cancelRename: () => void
	runCommand: (commandId: FileExplorerCommandId, node: FileTreeNode) => void
	showEntryMenu: (node: FileTreeNode, position: MenuPosition) => void
	showRootMenu: (position: MenuPosition) => void
	reportDropError: (error: unknown) => Promise<void>
}

interface UseFileSidebarActionsOptions {
	vaultPath: string
	treeScrollRef: RefObject<HTMLDivElement | null>
	toggle: (path: string) => void
	ensureExpanded: (path: string) => void
	focusPath: (path: string) => void
	showMenu: (items: ReturnType<typeof buildFileMenuItems>, position: MenuPosition) => void
}

const initialFileSidebarUiState: FileSidebarUiState = {
	renamingPath: null,
	creatingIn: null,
	creatingType: null,
}

export function useFileSidebarActions({
	vaultPath,
	treeScrollRef,
	toggle,
	ensureExpanded,
	focusPath,
	showMenu,
}: UseFileSidebarActionsOptions): { uiState: FileSidebarUiState; actions: FileTreeActions } {
	const [uiState, dispatchUi] = useReducer(fileSidebarUiReducer, initialFileSidebarUiState)

	const actions = useMemo<FileTreeActions>(() => {
		const startCreate = (parentPath: string, createType: FileCreateType) => {
			ensureExpanded(parentPath)
			dispatchUi({ type: "startCreate", parentPath, createType })
		}
		const startRename = (path: string) => dispatchUi({ type: "startRename", path })
		const showEntryMenu = (node: FileTreeNode, position: MenuPosition) =>
			showMenu(
				buildFileMenuItems(
					{ filePath: node.path, isDirectory: node.isDir },
					{
						onNewNote: node.isDir ? () => startCreate(node.path, "file") : undefined,
						onNewFolder: node.isDir ? () => startCreate(node.path, "folder") : undefined,
					},
				),
				position,
			)

		return {
			openFile: (path, mode) =>
				useWorkspaceStore
					.getState()
					.openTab(path, mode === "reuse-active" ? { reuseActive: true } : undefined),
			openDatabase: (path, mode) => openDatabaseView(path, { newTab: mode === "new-tab" }),
			toggle,
			ensureExpanded,
			focusPath,
			startCreate,
			confirmCreate: async (parentPath, name, createType) => {
				const vaultState = useVaultStore.getState()
				try {
					if (createType === "folder") {
						await vaultState.createFolder(parentPath, name)
					} else {
						useWorkspaceStore.getState().openTab(await vaultState.createFile(parentPath, name))
					}
				} catch (error) {
					await reportAppError({
						operation: "create-file-entry",
						source: "file-explorer",
						cause: error,
						userMessage: "The file or folder could not be created.",
						context: { parentPath, name },
					})
				}
				dispatchUi({ type: "cancelCreate" })
			},
			cancelCreate: () => dispatchUi({ type: "cancelCreate" }),
			startRename,
			confirmRename: async (oldPath, newName) => {
				try {
					await useVaultStore.getState().renameFile(oldPath, newName)
				} catch (error) {
					await reportAppError({
						operation: "rename-file-entry",
						source: "file-explorer",
						cause: error,
						userMessage: "The file or folder could not be renamed.",
						context: { oldPath, newName },
					})
				}
				dispatchUi({ type: "cancelRename" })
			},
			cancelRename: () => dispatchUi({ type: "cancelRename" }),
			runCommand: (commandId, node) => {
				if (commandId === FILE_EXPLORER_COMMAND_IDS.rename) {
					startRename(node.path)
				} else if (commandId === FILE_EXPLORER_COMMAND_IDS.delete) {
					executeCommand(FILE_COMMAND_IDS.delete, {
						source: "hotkey",
						payload: { filePath: node.path },
					})
				} else {
					const element = document.getElementById(getFileTreeItemId(node.path))
					showEntryMenu(node, getKeyboardMenuPosition(element))
					treeScrollRef.current?.focus({ preventScroll: true })
				}
			},
			showEntryMenu,
			showRootMenu: (position) => {
				if (!vaultPath || !canWriteVaultPath(vaultPath, true)) return
				showMenu(
					[
						{
							id: "new-file",
							text: "New Note",
							icon: FilePlusIcon,
							action: () => startCreate(vaultPath, "file"),
						},
						{
							id: "new-folder",
							text: "New Folder",
							icon: FolderPlusIcon,
							action: () => startCreate(vaultPath, "folder"),
						},
					],
					position,
				)
			},
			reportDropError: (error) =>
				reportAppError({
					operation: "move-file-entry",
					source: "file-explorer",
					cause: error,
					userMessage: "The file or folder could not be moved.",
				}),
		}
	}, [ensureExpanded, focusPath, showMenu, toggle, treeScrollRef, vaultPath])

	return { uiState, actions }
}

function fileSidebarUiReducer(
	state: FileSidebarUiState,
	action: FileSidebarUiAction,
): FileSidebarUiState {
	switch (action.type) {
		case "startCreate":
			return { renamingPath: null, creatingIn: action.parentPath, creatingType: action.createType }
		case "cancelCreate":
			return { ...state, creatingIn: null, creatingType: null }
		case "startRename":
			return { creatingIn: null, creatingType: null, renamingPath: action.path }
		case "cancelRename":
			return { ...state, renamingPath: null }
	}
}
