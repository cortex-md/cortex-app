import type { useVaultStore, useWorkspaceStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { type MouseEvent as ReactMouseEvent, type RefObject, useCallback, useReducer } from "react"
import { NativeMenuActions } from "@/utils/context-menu"
import { reportAppError } from "@/utils/reportAppError"
import type { FileOpenRequest } from "./FileSidebarTree"
import type { FileTreeNode } from "./fileTree"
import { getFileTreeItemId, getKeyboardMenuPosition } from "./fileTreeDom"
import { buildRootContextMenuItems } from "./NativeMenuActions"

type VaultStoreState = ReturnType<typeof useVaultStore.getState>
type WorkspaceStoreState = ReturnType<typeof useWorkspaceStore.getState>

interface FileSidebarUiState {
	renamingPath: string | null
	creatingIn: string | null
	creatingType: "file" | "folder" | null
	historyFilePath: string | null
}

type FileSidebarUiAction =
	| { type: "startCreate"; parentPath: string; createType: "file" | "folder" }
	| { type: "cancelCreate" }
	| { type: "startRename"; path: string }
	| { type: "cancelRename" }
	| { type: "openHistory"; path: string }
	| { type: "closeHistory" }

interface UseFileSidebarActionsOptions {
	closeTabsByPath: WorkspaceStoreState["closeTabsByPath"]
	createFile: VaultStoreState["createFile"]
	createFolder: VaultStoreState["createFolder"]
	deleteFile: VaultStoreState["deleteFile"]
	duplicateFile: VaultStoreState["duplicateFile"]
	ensureExpanded: (path: string) => void
	openTab: WorkspaceStoreState["openTab"]
	renameFile: VaultStoreState["renameFile"]
	treeScrollRef: RefObject<HTMLDivElement | null>
	vaultPath: string
}

const initialFileSidebarUiState: FileSidebarUiState = {
	renamingPath: null,
	creatingIn: null,
	creatingType: null,
	historyFilePath: null,
}

const hasNativeMenu = () => getPlatform().capabilities.includes("menu")

const nativeMenu = new NativeMenuActions()

function isFileTreeItemContextTarget(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false
	return Boolean(
		target.closest(
			"[data-file-tree-path], .file-tree-create-row, input, textarea, [contenteditable='true']",
		),
	)
}

export function useFileSidebarActions({
	closeTabsByPath,
	createFile,
	createFolder,
	deleteFile,
	duplicateFile,
	ensureExpanded,
	openTab,
	renameFile,
	treeScrollRef,
	vaultPath,
}: UseFileSidebarActionsOptions) {
	const [uiState, dispatchUi] = useReducer(fileSidebarUiReducer, initialFileSidebarUiState)
	const { creatingType } = uiState

	const handleNewFile = useCallback(
		(parentPath: string) => {
			ensureExpanded(parentPath)
			dispatchUi({ type: "startCreate", parentPath, createType: "file" })
		},
		[ensureExpanded],
	)

	const handleNewFolder = useCallback(
		(parentPath: string) => {
			ensureExpanded(parentPath)
			dispatchUi({ type: "startCreate", parentPath, createType: "folder" })
		},
		[ensureExpanded],
	)

	const handleConfirmCreate = useCallback(
		async (parentPath: string, name: string) => {
			try {
				if (creatingType === "folder") {
					await createFolder(parentPath, name)
				} else {
					const filePath = await createFile(parentPath, name)
					openTab(filePath)
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
		[creatingType, createFile, createFolder, openTab],
	)

	const handleCancelCreate = useCallback(() => {
		dispatchUi({ type: "cancelCreate" })
	}, [])

	const handleCancelRename = useCallback(() => dispatchUi({ type: "cancelRename" }), [])

	const handleConfirmRename = useCallback(
		async (oldPath: string, newName: string) => {
			try {
				await renameFile(oldPath, newName)
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
		[renameFile],
	)

	const handleDelete = useCallback(
		async (filePath: string, _isDir: boolean) => {
			const platform = getPlatform()
			const name = filePath.split("/").pop() ?? filePath
			const confirmed = await platform.dialog.showConfirm(
				"Delete",
				`Are you sure you want to delete "${name}"?`,
			)
			if (!confirmed) return
			closeTabsByPath(filePath)
			try {
				await deleteFile(filePath)
			} catch (error) {
				await reportAppError({
					operation: "delete-file-entry",
					source: "file-explorer",
					cause: error,
					userMessage: `"${name}" could not be deleted.`,
					context: { filePath },
				})
			}
		},
		[deleteFile, closeTabsByPath],
	)

	const handleDuplicate = useCallback(
		async (filePath: string) => {
			try {
				const newPath = await duplicateFile(filePath)
				openTab(newPath)
			} catch (error) {
				await reportAppError({
					operation: "duplicate-file",
					source: "file-explorer",
					cause: error,
					userMessage: "The note could not be duplicated.",
					context: { filePath },
				})
			}
		},
		[duplicateFile, openTab],
	)

	const handleOpenFile = useCallback(
		(filePath: string, request: FileOpenRequest) => {
			if (request.mode === "new-tab") {
				openTab(filePath)
				return
			}
			openTab(filePath, { reuseActive: true })
		},
		[openTab],
	)

	const handleReveal = useCallback(async (filePath: string) => {
		const platform = getPlatform()
		await platform.dialog.revealFolder(filePath)
	}, [])

	const handleCopyPath = useCallback(
		(filePath: string, kind: "relative" | "absolute") => {
			if (kind === "relative" && vaultPath) {
				navigator.clipboard.writeText(filePath.replace(`${vaultPath}/`, ""))
			} else {
				navigator.clipboard.writeText(filePath)
			}
		},
		[vaultPath],
	)

	const handleStartRename = useCallback(
		(path: string) => dispatchUi({ type: "startRename", path }),
		[],
	)

	const handleViewHistory = useCallback(
		(path: string) => dispatchUi({ type: "openHistory", path }),
		[],
	)

	const handleHistoryOpenChange = useCallback((open: boolean) => {
		if (!open) dispatchUi({ type: "closeHistory" })
	}, [])

	const handleOpenContextMenu = useCallback(
		(node: FileTreeNode) => {
			const element = document.getElementById(getFileTreeItemId(node.path))
			const position = getKeyboardMenuPosition(element)
			element?.dispatchEvent(
				new MouseEvent("contextmenu", {
					bubbles: true,
					cancelable: true,
					button: 2,
					clientX: position.x,
					clientY: position.y,
				}),
			)
			treeScrollRef.current?.focus({ preventScroll: true })
		},
		[treeScrollRef],
	)

	const handleDropError = useCallback(async (error: unknown) => {
		await reportAppError({
			operation: "move-file-entry",
			source: "file-explorer",
			cause: error,
			userMessage: "The file or folder could not be moved.",
		})
	}, [])

	const handleRootContextMenu = useCallback(
		(event: ReactMouseEvent<HTMLDivElement>) => {
			if (!vaultPath || !hasNativeMenu()) return
			if (isFileTreeItemContextTarget(event.target)) return
			event.preventDefault()
			const items = buildRootContextMenuItems(vaultPath, {
				createFile: (parentPath) => handleNewFile(parentPath ?? vaultPath),
				createFolder: (parentPath) => handleNewFolder(parentPath ?? vaultPath),
			})
			nativeMenu.showContextMenu({ items, position: { x: event.clientX, y: event.clientY } })
		},
		[handleNewFile, handleNewFolder, vaultPath],
	)

	return {
		uiState,
		handleCancelCreate,
		handleCancelRename,
		handleConfirmCreate,
		handleConfirmRename,
		handleCopyPath,
		handleDelete,
		handleDropError,
		handleDuplicate,
		handleHistoryOpenChange,
		handleNewFile,
		handleNewFolder,
		handleOpenContextMenu,
		handleOpenFile,
		handleReveal,
		handleRootContextMenu,
		handleStartRename,
		handleViewHistory,
	}
}

function fileSidebarUiReducer(
	state: FileSidebarUiState,
	action: FileSidebarUiAction,
): FileSidebarUiState {
	switch (action.type) {
		case "startCreate":
			return {
				...state,
				renamingPath: null,
				creatingIn: action.parentPath,
				creatingType: action.createType,
			}
		case "cancelCreate":
			return { ...state, creatingIn: null, creatingType: null }
		case "startRename":
			return { ...state, creatingIn: null, creatingType: null, renamingPath: action.path }
		case "cancelRename":
			return { ...state, renamingPath: null }
		case "openHistory":
			return { ...state, historyFilePath: action.path }
		case "closeHistory":
			return { ...state, historyFilePath: null }
	}
}
