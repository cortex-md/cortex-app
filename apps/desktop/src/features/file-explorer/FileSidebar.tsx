import { useVaultStore, useWorkspaceStore } from "@cortex/core"
import { useHotkeysStore } from "@cortex/hotkeys"
import { usePluginStore } from "@cortex/plugin-host-web"
import { useSettingsStore } from "@cortex/settings"
import { Button } from "@cortex/ui"
import { FilePlusIcon, FolderPlusIcon } from "lucide-react"
import { useCallback, useMemo, useRef, useState } from "react"
import { NoteHistoryPanel } from "../sync/NoteHistoryPanel"
import { FileSidebarTree } from "./FileSidebarTree"
import {
	createFileExplorerHotkeyBindings,
	useFileExplorerCommandListener,
} from "./fileExplorerKeyboard"
import { useFileSidebarActions } from "./useFileSidebarActions"
import { useFileSidebarTreeModel } from "./useFileSidebarTreeModel"

interface FileSidebarHeaderProps {
	vaultPath: string
	onNewFile: (parentPath: string) => void
	onNewFolder: (parentPath: string) => void
}

function FileSidebarHeader({ vaultPath, onNewFile, onNewFolder }: FileSidebarHeaderProps) {
	return (
		<div className="file-sidebar-header flex items-center justify-between flex-shrink-0">
			<span className="file-sidebar-title">Files</span>
			<div className="flex items-center gap-1">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={() => onNewFile(vaultPath)}
					className="sidebar-action-button text-text-muted hover:text-text-primary hover:bg-bg-hover"
					title="New Note"
					aria-label="New Note"
				>
					<FilePlusIcon size={16} />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={() => onNewFolder(vaultPath)}
					className="sidebar-action-button text-text-muted hover:text-text-primary hover:bg-bg-hover"
					title="New Folder"
					aria-label="New Folder"
				>
					<FolderPlusIcon size={16} />
				</Button>
			</div>
		</div>
	)
}

export function FileSidebar() {
	const vault = useVaultStore((s) => s.vault)
	const files = useVaultStore((s) => s.files)
	const createFile = useVaultStore((s) => s.createFile)
	const createFolder = useVaultStore((s) => s.createFolder)
	const deleteFile = useVaultStore((s) => s.deleteFile)
	const renameFile = useVaultStore((s) => s.renameFile)
	const duplicateFile = useVaultStore((s) => s.duplicateFile)
	const openTab = useWorkspaceStore((s) => s.openTab)
	const closeTabsByPath = useWorkspaceStore((s) => s.closeTabsByPath)
	const activeFilePath = useWorkspaceStore((s) => {
		const activePane = s.panes[s.activePaneId]
		const activeTab = activePane?.tabs.find((tab) => tab.id === activePane.activeTabId)
		return activeTab?.filePath
	})
	const [expanded, setExpanded] = useState<Set<string>>(new Set())
	const [focusedPathOverride, setFocusedPathOverride] = useState<string | null>(null)
	const vimMode = useSettingsStore((state) => state.settings.editor.vimMode)
	const hotkeyBindings = useHotkeysStore((state) => state.bindings)
	const pluginContextMenuItems = usePluginStore((state) => state.contextMenuItems)

	const treeScrollRef = useRef<HTMLDivElement>(null)
	const vaultPath = vault?.path ?? ""
	const fileExplorerBindings = useMemo(
		() => createFileExplorerHotkeyBindings(hotkeyBindings),
		[hotkeyBindings],
	)

	const handleToggle = useCallback((path: string) => {
		setExpanded((prev) => {
			const next = new Set(prev)
			if (next.has(path)) next.delete(path)
			else next.add(path)
			return next
		})
	}, [])

	const ensureExpanded = useCallback((path: string) => {
		setExpanded((prev) => {
			if (prev.has(path)) return prev
			const next = new Set(prev)
			next.add(path)
			return next
		})
	}, [])

	const {
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
	} = useFileSidebarActions({
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
	})
	const { renamingPath, creatingIn, creatingType, historyFilePath } = uiState

	const { tree, rows, nodeRows, nodeRowIndexByPath, focusedPath, focusedNode, rowVirtualizer } =
		useFileSidebarTreeModel({
			files,
			vaultPath,
			hasVault: Boolean(vault),
			expanded,
			creatingIn,
			creatingType,
			activeFilePath,
			focusedPathOverride,
			treeScrollRef,
		})
	useFileExplorerCommandListener({
		treeScrollRef,
		focusedNode,
		onOpenContextMenu: handleOpenContextMenu,
		onStartRename: handleStartRename,
		onDelete: handleDelete,
	})

	if (!vault) {
		return
	}

	const isCreatingAtRoot = creatingIn === vault.path

	return (
		<div className="file-sidebar flex flex-col h-full px-1.5 overflow-hidden">
			<FileSidebarHeader
				vaultPath={vault.path}
				onNewFile={handleNewFile}
				onNewFolder={handleNewFolder}
			/>
			<FileSidebarTree
				tree={tree}
				rows={rows}
				nodeRows={nodeRows}
				nodeRowIndexByPath={nodeRowIndexByPath}
				isCreatingAtRoot={isCreatingAtRoot}
				activeFilePath={activeFilePath}
				focusedPath={focusedPath}
				vaultPath={vault.path}
				expanded={expanded}
				renamingPath={renamingPath}
				vimMode={vimMode}
				treeScrollRef={treeScrollRef}
				rowVirtualizer={rowVirtualizer}
				fileExplorerBindings={fileExplorerBindings}
				onRootContextMenu={handleRootContextMenu}
				onFocusPath={setFocusedPathOverride}
				onFocusedPathChange={setFocusedPathOverride}
				onConfirmCreate={handleConfirmCreate}
				onCancelCreate={handleCancelCreate}
				onToggle={handleToggle}
				onEnsureExpanded={ensureExpanded}
				onOpenFile={handleOpenFile}
				onStartRename={handleStartRename}
				onConfirmRename={handleConfirmRename}
				onCancelRename={handleCancelRename}
				onOpenContextMenu={handleOpenContextMenu}
				onDelete={handleDelete}
				onDuplicate={handleDuplicate}
				onReveal={handleReveal}
				onCopyPath={handleCopyPath}
				onNewFile={handleNewFile}
				onNewFolder={handleNewFolder}
				onViewHistory={handleViewHistory}
				onDropError={handleDropError}
				pluginContextMenuItems={pluginContextMenuItems}
			/>
			<NoteHistoryPanel
				filePath={historyFilePath ?? ""}
				open={historyFilePath !== null}
				onOpenChange={handleHistoryOpenChange}
			/>
		</div>
	)
}
