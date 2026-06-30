import { executeCommand } from "@cortex/commands"
import {
	isSyncImagePath,
	shouldIgnoreSyncPath,
	useBookmarksStore,
	useDragStore,
	useRemoteVaultStore,
	useSyncStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import {
	Button,
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
	Input,
} from "@cortex/ui"
import type { ContextMenuItemRegistration } from "@cortex.md/api"
import type { Virtualizer } from "@tanstack/react-virtual"
import {
	ChevronRightIcon,
	ClipboardCopyIcon,
	CloudOffIcon,
	FilePlusIcon,
	FolderIcon,
	FolderPlusIcon,
	PencilIcon,
	TrashIcon,
} from "lucide-react"
import { type MouseEvent, memo, type RefObject, useEffect, useMemo, useRef } from "react"
import { NativeMenuActions } from "@/utils/context-menu"
import { exportNoteFromDialog } from "../import-export/importExportActions"
import { createPluginContextMenuItems } from "../plugins/pluginContextMenu"
import { useInternalDragSource } from "../split-view/useInternalDragSource"
import { type FileExplorerHotkeyBinding, useFileExplorerKeyboard } from "./fileExplorerKeyboard"
import type { FileTreeNode, FileTreeRow, FileTreeVisibleNodeRow } from "./fileTree"
import { getFileTreeItemId } from "./fileTreeDom"
import { getFileTreeDepthStyle } from "./fileTreeLayout"
import { buildFileContextMenuItems, buildNoteMenuItems } from "./NativeMenuActions"
import { NoteContextMenuItems } from "./NoteMenuItems"

const fileTreeAutoExpandDelayMs = 480

function isMarkdownPath(path: string): boolean {
	return path.toLocaleLowerCase().endsWith(".md")
}

export type FileOpenMode = "reuse-active" | "new-tab"

export interface FileOpenRequest {
	mode: FileOpenMode
}

interface FileActions {
	onOpenFile: (path: string, request: FileOpenRequest) => void
	onNewFile: (parentPath: string) => void
	onNewFolder: (parentPath: string) => void
	onStartRename: (path: string) => void
	onDelete: (path: string, isDir: boolean) => void
	onDuplicate: (path: string) => void
	onReveal: (path: string) => void
	onCopyPath: (path: string, kind: "relative" | "absolute") => void
	onViewHistory: (path: string) => void
}

interface TreeNodeVisualState {
	active: boolean
	expanded: boolean
	focused: boolean
	renaming: boolean
}

interface InlineInputProps {
	defaultValue: string
	onConfirm: (value: string) => void
	onCancel: () => void
	selectBaseName?: boolean
}

interface TreeNodeRowProps {
	node: FileTreeNode
	depth: number
	visualState: TreeNodeVisualState
	parentPath: string
	dropPosition: string | null
	onToggle: (path: string) => void
	onOpenFile: (path: string, request: FileOpenRequest) => void
	onFocusPath: (path: string) => void
	onConfirmRename: (oldPath: string, newName: string) => void
	onCancelRename: () => void
	onDropError: (error: unknown) => void
}

interface TreeNodeProps {
	node: FileTreeNode
	depth: number
	visualState: TreeNodeVisualState
	parentPath: string
	dropPosition: string | null
	onOpenFile: (path: string, request: FileOpenRequest) => void
	onToggle: (path: string) => void
	onFocusPath: (path: string) => void
	onStartRename: (path: string) => void
	onConfirmRename: (oldPath: string, newName: string) => void
	onCancelRename: () => void
	onDropError: (error: unknown) => void
	onDelete: (path: string, isDir: boolean) => void
	onDuplicate: (path: string) => void
	onReveal: (path: string) => void
	onCopyPath: (path: string, kind: "relative" | "absolute") => void
	onNewFile: (parentPath: string) => void
	onNewFolder: (parentPath: string) => void
	onViewHistory: (path: string) => void
	pluginContextMenuItems: ContextMenuItemRegistration[]
}

export interface FileSidebarTreeProps {
	tree: FileTreeNode[]
	rows: FileTreeRow[]
	nodeRows: FileTreeVisibleNodeRow[]
	nodeRowIndexByPath: Map<string, number>
	isCreatingAtRoot: boolean
	activeFilePath: string | undefined
	focusedPath: string | null
	vaultPath: string
	expanded: Set<string>
	renamingPath: string | null
	vimMode: boolean
	treeScrollRef: RefObject<HTMLDivElement | null>
	rowVirtualizer: Virtualizer<HTMLDivElement, Element>
	fileExplorerBindings: FileExplorerHotkeyBinding[]
	onRootContextMenu: (event: MouseEvent<HTMLDivElement>) => void
	onFocusPath: (path: string) => void
	onFocusedPathChange: (path: string) => void
	onConfirmCreate: (parentPath: string, name: string) => void
	onCancelCreate: () => void
	onToggle: (path: string) => void
	onEnsureExpanded: (path: string) => void
	onOpenFile: (path: string, request: FileOpenRequest) => void
	onStartRename: (path: string) => void
	onConfirmRename: (oldPath: string, newName: string) => void
	onCancelRename: () => void
	onOpenContextMenu: (node: FileTreeNode) => void
	onDelete: (path: string, isDir: boolean) => void
	onDuplicate: (path: string) => void
	onReveal: (path: string) => void
	onCopyPath: (path: string, kind: "relative" | "absolute") => void
	onNewFile: (parentPath: string) => void
	onNewFolder: (parentPath: string) => void
	onViewHistory: (path: string) => void
	onDropError: (error: unknown) => void
	pluginContextMenuItems: ContextMenuItemRegistration[]
}

type FileTreeDropTarget = ReturnType<typeof useDragStore.getState>["dropTarget"]

interface FileSidebarTreeRowsProps {
	rows: FileTreeRow[]
	activeFilePath: string | undefined
	focusedPath: string | null
	expanded: Set<string>
	renamingPath: string | null
	rowVirtualizer: Virtualizer<HTMLDivElement, Element>
	dropTarget: FileTreeDropTarget
	onFocusPath: (path: string) => void
	onConfirmCreate: (parentPath: string, name: string) => void
	onCancelCreate: () => void
	onToggle: (path: string) => void
	onOpenFile: (path: string, request: FileOpenRequest) => void
	onStartRename: (path: string) => void
	onConfirmRename: (oldPath: string, newName: string) => void
	onCancelRename: () => void
	onDelete: (path: string, isDir: boolean) => void
	onDuplicate: (path: string) => void
	onReveal: (path: string) => void
	onCopyPath: (path: string, kind: "relative" | "absolute") => void
	onNewFile: (parentPath: string) => void
	onNewFolder: (parentPath: string) => void
	onViewHistory: (path: string) => void
	onDropError: (error: unknown) => void
	pluginContextMenuItems: ContextMenuItemRegistration[]
}

const hasNativeMenu = () => getPlatform().capabilities.includes("menu")

const nativeMenu = new NativeMenuActions()

const treeNodeVisualStates = Array.from(
	{ length: 16 },
	(_, key): TreeNodeVisualState => ({
		active: Boolean(key & 1),
		expanded: Boolean(key & 2),
		focused: Boolean(key & 4),
		renaming: Boolean(key & 8),
	}),
)

export function FileSidebarTree({
	tree,
	rows,
	nodeRows,
	nodeRowIndexByPath,
	isCreatingAtRoot,
	activeFilePath,
	focusedPath,
	vaultPath,
	expanded,
	renamingPath,
	vimMode,
	treeScrollRef,
	rowVirtualizer,
	fileExplorerBindings,
	onRootContextMenu,
	onFocusPath,
	onFocusedPathChange,
	onConfirmCreate,
	onCancelCreate,
	onToggle,
	onEnsureExpanded,
	onOpenFile,
	onStartRename,
	onConfirmRename,
	onCancelRename,
	onOpenContextMenu,
	onDelete,
	onDuplicate,
	onReveal,
	onCopyPath,
	onNewFile,
	onNewFolder,
	onViewHistory,
	onDropError,
	pluginContextMenuItems,
}: FileSidebarTreeProps) {
	const dropTarget = useDragStore((state) => state.dropTarget)
	const autoExpandTimerRef = useRef<number | null>(null)
	const autoExpandPath =
		dropTarget?.type === "file-tree" && dropTarget.fileTreePosition === "inside"
			? (dropTarget.fileTreePath ?? null)
			: null
	const { handleFocus, handleKeyDown } = useFileExplorerKeyboard({
		activeFilePath,
		expanded,
		fileExplorerBindings,
		focusedPath,
		nodeRows,
		nodeRowIndexByPath,
		rowVirtualizer,
		treeScrollRef,
		vimMode,
		onDelete,
		onEnsureExpanded,
		onFocusedPathChange,
		onOpenContextMenu,
		onOpenFile: (path) => onOpenFile(path, { mode: "reuse-active" }),
		onStartRename,
		onToggle,
	})

	useEffect(
		() => () => {
			if (autoExpandTimerRef.current !== null) window.clearTimeout(autoExpandTimerRef.current)
		},
		[],
	)

	useEffect(() => {
		if (autoExpandTimerRef.current !== null) {
			window.clearTimeout(autoExpandTimerRef.current)
			autoExpandTimerRef.current = null
		}
		if (!autoExpandPath || expanded.has(autoExpandPath)) return

		autoExpandTimerRef.current = window.setTimeout(() => {
			autoExpandTimerRef.current = null
			onEnsureExpanded(autoExpandPath)
		}, fileTreeAutoExpandDelayMs)
	}, [autoExpandPath, expanded, onEnsureExpanded])

	const rootDropActive = dropTarget?.type === "file-tree" && dropTarget.fileTreePosition === "root"

	return (
		<div
			ref={treeScrollRef}
			className={`flex-1 overflow-y-auto px-1 pb-1 ${rootDropActive ? "file-tree-root-drop-active" : ""}`}
			role="tree"
			tabIndex={0}
			aria-activedescendant={focusedPath ? getFileTreeItemId(focusedPath) : undefined}
			data-file-tree-root-drop-target=""
			data-file-tree-root-path={vaultPath}
			onContextMenu={onRootContextMenu}
			onFocus={handleFocus}
			onKeyDown={handleKeyDown}
		>
			{tree.length === 0 && !isCreatingAtRoot ? (
				<div className="flex items-center justify-center p-8 text-xs text-text-muted">No files</div>
			) : (
				<FileSidebarTreeRows
					rows={rows}
					activeFilePath={activeFilePath}
					focusedPath={focusedPath}
					expanded={expanded}
					renamingPath={renamingPath}
					rowVirtualizer={rowVirtualizer}
					dropTarget={dropTarget}
					onFocusPath={onFocusPath}
					onConfirmCreate={onConfirmCreate}
					onCancelCreate={onCancelCreate}
					onToggle={onToggle}
					onOpenFile={onOpenFile}
					onStartRename={onStartRename}
					onConfirmRename={onConfirmRename}
					onCancelRename={onCancelRename}
					onDelete={onDelete}
					onDuplicate={onDuplicate}
					onReveal={onReveal}
					onCopyPath={onCopyPath}
					onNewFile={onNewFile}
					onNewFolder={onNewFolder}
					onViewHistory={onViewHistory}
					onDropError={onDropError}
					pluginContextMenuItems={pluginContextMenuItems}
				/>
			)}
		</div>
	)
}

function FileSidebarTreeRows({
	rows,
	activeFilePath,
	focusedPath,
	expanded,
	renamingPath,
	rowVirtualizer,
	dropTarget,
	onFocusPath,
	onConfirmCreate,
	onCancelCreate,
	onToggle,
	onOpenFile,
	onStartRename,
	onConfirmRename,
	onCancelRename,
	onDelete,
	onDuplicate,
	onReveal,
	onCopyPath,
	onNewFile,
	onNewFolder,
	onViewHistory,
	onDropError,
	pluginContextMenuItems,
}: FileSidebarTreeRowsProps) {
	return (
		<div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
			{rowVirtualizer.getVirtualItems().map((virtualRow) => {
				const row = rows[virtualRow.index]
				return (
					<div
						key={virtualRow.key}
						className="file-tree-row absolute left-0 top-0 w-full"
						data-depth={row.depth}
						style={{
							...getFileTreeDepthStyle(row.depth),
							height: `${virtualRow.size}px`,
							transform: `translateY(${virtualRow.start}px)`,
						}}
					>
						{row.kind === "create" ? (
							<div
								className="file-tree-create-row flex items-center gap-1"
								data-create-type={row.createType}
							>
								{row.createType === "folder" && (
									<ChevronRightIcon
										size={15}
										strokeWidth={2.5}
										className="text-text-muted flex-shrink-0"
									/>
								)}
								<InlineInput
									defaultValue={row.createType === "folder" ? "New Folder" : "Untitled"}
									onConfirm={(name) => onConfirmCreate(row.parentPath, name)}
									onCancel={onCancelCreate}
									selectBaseName={row.createType === "file"}
								/>
							</div>
						) : (
							<MemoizedTreeNodeView
								node={row.node}
								depth={row.depth}
								visualState={getTreeNodeVisualState(
									!row.node.isDir && activeFilePath === row.node.path,
									expanded.has(row.node.path),
									focusedPath === row.node.path,
									renamingPath === row.node.path,
								)}
								parentPath={getParentPath(row.node.path)}
								dropPosition={
									dropTarget?.type === "file-tree" && dropTarget.fileTreePath === row.node.path
										? (dropTarget.fileTreePosition ?? null)
										: null
								}
								onToggle={onToggle}
								onOpenFile={onOpenFile}
								onFocusPath={onFocusPath}
								onStartRename={onStartRename}
								onConfirmRename={onConfirmRename}
								onCancelRename={onCancelRename}
								onDropError={onDropError}
								onDelete={onDelete}
								onDuplicate={onDuplicate}
								onReveal={onReveal}
								onCopyPath={onCopyPath}
								onNewFile={onNewFile}
								onNewFolder={onNewFolder}
								onViewHistory={onViewHistory}
								pluginContextMenuItems={pluginContextMenuItems}
							/>
						)}
					</div>
				)
			})}
		</div>
	)
}

function TreeNodeView({
	node,
	depth,
	visualState,
	parentPath,
	dropPosition,
	onOpenFile,
	onToggle,
	onFocusPath,
	onStartRename,
	onConfirmRename,
	onCancelRename,
	onDropError,
	onDelete,
	onDuplicate,
	onReveal,
	onCopyPath,
	onNewFile,
	onNewFolder,
	onViewHistory,
	pluginContextMenuItems,
}: TreeNodeProps) {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const syncPreferences = useSyncStore((state) => state.syncPreferences)
	const syncEnabled = useRemoteVaultStore((state) => state.syncConfig.enabled)
	const remoteVaultId = useRemoteVaultStore((state) => state.syncConfig.remoteVaultId)
	const bookmarked = useBookmarksStore((state) =>
		vaultPath ? state.isBookmarked(vaultPath, node.path) : false,
	)
	const pluginFileMenuItems = useMemo(
		() =>
			createPluginContextMenuItems(pluginContextMenuItems, "file", {
				location: "file",
				filePath: node.path,
			}),
		[pluginContextMenuItems, node.path],
	)

	const rowProps = {
		node,
		depth,
		visualState,
		parentPath,
		dropPosition,
		onToggle,
		onOpenFile,
		onFocusPath,
		onConfirmRename,
		onCancelRename,
		onDropError,
	}

	const fileActions: FileActions = {
		onOpenFile,
		onNewFile,
		onNewFolder,
		onStartRename,
		onDelete,
		onDuplicate,
		onReveal,
		onCopyPath,
		onViewHistory,
	}
	const relativePath = vaultPath ? node.path.replace(`${vaultPath}/`, "") : node.path
	const syncIgnored = shouldIgnoreSyncPath(relativePath, syncPreferences)
	const supportsNoteActions = !node.isDir && isMarkdownPath(node.path)
	const canToggleSync = !(
		syncPreferences.ignoreImages &&
		!node.isDir &&
		isSyncImagePath(relativePath)
	)
	const noteMenuItems = useMemo(
		() => [
			...buildNoteMenuItems(
				{
					path: node.path,
					bookmarked,
					syncIgnored,
					showVersionHistory: supportsNoteActions && syncEnabled && remoteVaultId !== null,
					canToggleSync: Boolean(vaultPath) && canToggleSync,
					supportsNoteActions,
				},
				{
					openInNewTab: (path) => useWorkspaceStore.getState().openTab(path),
					openInRightSplit: (path) => {
						const workspace = useWorkspaceStore.getState()
						if (workspace.activePaneId) {
							workspace.openInSplit(path, workspace.activePaneId, "horizontal")
						}
					},
					duplicate: onDuplicate,
					exportNote: (path, format) => void exportNoteFromDialog(path, format, "context-menu"),
					copyRelativePath: (path) => onCopyPath(path, "relative"),
					copyAbsolutePath: (path) => onCopyPath(path, "absolute"),
					reveal: onReveal,
					showVersionHistory: onViewHistory,
					toggleBookmark: (path) => {
						executeCommand("bookmarks.toggle", {
							source: "menu",
							payload: { filePath: path },
						})
					},
					toggleSyncIgnore: (path, ignored) => {
						if (!vaultPath) return
						const relative = path.replace(`${vaultPath}/`, "")
						void useSyncStore.getState().toggleExcludedPath(relative, ignored)
					},
					rename: onStartRename,
					delete: (path) => onDelete(path, false),
				},
			),
			...pluginFileMenuItems,
		],
		[
			canToggleSync,
			bookmarked,
			node.path,
			onCopyPath,
			onDelete,
			onDuplicate,
			onReveal,
			onStartRename,
			onViewHistory,
			remoteVaultId,
			supportsNoteActions,
			syncEnabled,
			syncIgnored,
			pluginFileMenuItems,
			vaultPath,
		],
	)

	return (
		<>
			{hasNativeMenu() ? (
				// biome-ignore lint/a11y/noStaticElementInteractions: wrapper for native context menu
				<div
					onContextMenu={(e) => {
						e.preventDefault()
						e.stopPropagation()
						if (node.isDir) {
							showNativeFileContextMenu(
								node,
								{ x: e.clientX, y: e.clientY },
								fileActions,
								pluginFileMenuItems,
							)
						} else {
							nativeMenu.showContextMenu({
								items: noteMenuItems,
								position: { x: e.clientX, y: e.clientY },
							})
						}
					}}
				>
					<MemoizedTreeNodeRow {...rowProps} />
				</div>
			) : (
				<ContextMenu>
					<ContextMenuTrigger asChild>
						<MemoizedTreeNodeRow {...rowProps} />
					</ContextMenuTrigger>
					<ContextMenuContent>
						{node.isDir ? (
							<>
								<ContextMenuItem onSelect={() => onNewFile(node.path)}>
									<FilePlusIcon />
									New Note
								</ContextMenuItem>
								<ContextMenuItem onSelect={() => onNewFolder(node.path)}>
									<FolderPlusIcon />
									New Folder
								</ContextMenuItem>
								<ContextMenuSeparator />
							</>
						) : (
							<NoteContextMenuItems items={noteMenuItems} />
						)}
						{node.isDir && (
							<>
								<ContextMenuSub>
									<ContextMenuSubTrigger>
										<ClipboardCopyIcon />
										Copy path
									</ContextMenuSubTrigger>
									<ContextMenuSubContent>
										<ContextMenuItem onSelect={() => onCopyPath(node.path, "relative")}>
											Relative path
										</ContextMenuItem>
										<ContextMenuItem onSelect={() => onCopyPath(node.path, "absolute")}>
											Absolute path
										</ContextMenuItem>
									</ContextMenuSubContent>
								</ContextMenuSub>
								<ContextMenuSeparator />
								<ContextMenuItem onSelect={() => onReveal(node.path)}>
									<FolderIcon />
									Reveal in Finder
								</ContextMenuItem>
								<ContextMenuSeparator />
								<ContextMenuItem onSelect={() => onStartRename(node.path)}>
									<PencilIcon />
									Rename
									<ContextMenuShortcut>F2</ContextMenuShortcut>
								</ContextMenuItem>
								<ContextMenuItem
									variant="destructive"
									onSelect={() => onDelete(node.path, node.isDir)}
								>
									<TrashIcon />
									Delete
								</ContextMenuItem>
								<SyncExcludeMenuItem node={node} />
								<NoteContextMenuItems items={pluginFileMenuItems} />
							</>
						)}
					</ContextMenuContent>
				</ContextMenu>
			)}
		</>
	)
}

function TreeNodeRow({
	node,
	depth,
	visualState,
	parentPath,
	dropPosition,
	onToggle,
	onOpenFile,
	onFocusPath,
	onConfirmRename,
	onCancelRename,
	onDropError,
}: TreeNodeRowProps) {
	const canDragEntry = !visualState.renaming
	const dragProps = useInternalDragSource(
		() => ({
			type: "file",
			filePath: node.path,
			isDirectory: node.isDir,
		}),
		{ disabled: !canDragEntry, onDropError },
	)

	return (
		<Button
			id={getFileTreeItemId(node.path)}
			variant={"ghost"}
			role="treeitem"
			aria-level={depth + 1}
			aria-expanded={node.isDir ? visualState.expanded : undefined}
			aria-selected={visualState.focused}
			tabIndex={-1}
			data-file-tree-drop-target=""
			data-file-tree-is-directory={node.isDir}
			data-file-tree-parent-path={parentPath}
			data-file-tree-path={node.path}
			data-drop-position={dropPosition ?? undefined}
			className={`file-tree-item flex items-center text-left gap-1 w-full select-none outline-none focus-visible:ring-1 focus-visible:ring-border-focus ${
				visualState.active ? "active" : ""
			} ${visualState.focused ? "focused" : ""}`}
			{...dragProps}
			onClick={(event) => {
				if (visualState.renaming) return
				if (node.isDir) {
					onFocusPath(node.path)
					onToggle(node.path)
					return
				}

				onOpenFile(node.path, {
					mode: event.metaKey || event.ctrlKey ? "new-tab" : "reuse-active",
				})
				onFocusPath(node.path)
			}}
			onFocus={() => onFocusPath(node.path)}
		>
			{node.isDir && (
				<ChevronRightIcon
					size={15}
					strokeWidth={2.5}
					className={`text-text-muted flex-shrink-0 transition-transform duration-100 ${
						visualState.expanded ? "rotate-90" : ""
					}`}
				/>
			)}
			{visualState.renaming ? (
				<InlineInput
					defaultValue={node.name}
					onConfirm={(newName) => onConfirmRename(node.path, newName)}
					onCancel={onCancelRename}
					selectBaseName={!node.isDir}
				/>
			) : (
				<span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">
					{node.isDir ? node.name : node.name.replace(/\.md$/, "")}
				</span>
			)}
		</Button>
	)
}

function InlineInput({ defaultValue, onConfirm, onCancel, selectBaseName }: InlineInputProps) {
	const inputRef = useRef<HTMLInputElement>(null)
	const finishedRef = useRef(false)

	useEffect(() => {
		finishedRef.current = false
		const input = inputRef.current
		if (!input) return
		input.focus()
		if (selectBaseName) {
			const dotIndex = defaultValue.lastIndexOf(".")
			input.setSelectionRange(0, dotIndex > 0 ? dotIndex : defaultValue.length)
		} else {
			input.select()
		}
	}, [defaultValue, selectBaseName])

	const finish = (value: string | null, forceConfirm = false) => {
		if (finishedRef.current) return
		finishedRef.current = true
		if (value && (forceConfirm || value !== defaultValue)) onConfirm(value)
		else onCancel()
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault()
			const value = inputRef.current?.value.trim()
			finish(value ?? null, true)
		}
		if (e.key === "Escape") {
			e.preventDefault()
			finish(null)
		}
	}

	return (
		<Input
			ref={inputRef}
			type="text"
			size="sm"
			defaultValue={defaultValue}
			onKeyDown={handleKeyDown}
			onBlur={() => {
				const value = inputRef.current?.value.trim()
				finish(value ?? null)
			}}
			className="file-tree-inline-input"
		/>
	)
}

function SyncExcludeMenuItem({ node }: { node: FileTreeNode }) {
	const vaultPath = useVaultStore((s) => s.vault?.path)
	const syncPreferences = useSyncStore((s) => s.syncPreferences)

	if (!vaultPath) return null

	const relative = node.path.replace(`${vaultPath}/`, "")
	if (syncPreferences.ignoreImages && !node.isDir && isSyncImagePath(relative)) return null

	const normalized = node.isDir ? (relative.endsWith("/") ? relative : `${relative}/`) : relative
	const isExcluded = shouldIgnoreSyncPath(relative, syncPreferences)

	return (
		<>
			<ContextMenuSeparator />
			<ContextMenuItem
				onSelect={() => useSyncStore.getState().toggleExcludedPath(normalized, !isExcluded)}
			>
				<CloudOffIcon />
				{isExcluded ? "Include in Sync" : "Exclude from Sync"}
			</ContextMenuItem>
		</>
	)
}

function showNativeFileContextMenu(
	node: FileTreeNode,
	position: { x: number; y: number },
	actions: FileActions,
	pluginMenuItems: ReturnType<typeof createPluginContextMenuItems>,
) {
	const vault = useVaultStore.getState().vault
	const vaultPath = vault?.path
	const syncPreferences = useSyncStore.getState().syncPreferences
	const relative = vaultPath ? node.path.replace(`${vaultPath}/`, "") : ""
	const syncIgnoreToggleAvailable = !(
		syncPreferences.ignoreImages &&
		!node.isDir &&
		isSyncImagePath(relative)
	)
	const supportsNoteActions = !node.isDir && isMarkdownPath(node.path)
	const items = buildFileContextMenuItems(
		{
			path: node.path,
			fileName: node.name,
			isDirectory: node.isDir,
			selectionCount: 1,
			isMultiSelect: false,
		},
		{
			createFile: (parentPath) => actions.onNewFile(parentPath ?? node.path),
			createFolder: (parentPath) => actions.onNewFolder(parentPath ?? node.path),
			openInNewTab: (path) => actions.onOpenFile(path, { mode: "new-tab" }),
			openInRightSplit: (path) => {
				const { activePaneId } = useWorkspaceStore.getState()
				if (activePaneId) {
					useWorkspaceStore.getState().openInSplit(path, activePaneId, "horizontal")
				}
			},
			rename: (path) => actions.onStartRename(path),
			toggleBookmark: supportsNoteActions
				? (path) => {
						executeCommand("bookmarks.toggle", {
							source: "menu",
							payload: { filePath: path },
						})
					}
				: undefined,
			isBookmarked:
				vaultPath && supportsNoteActions
					? (path) => useBookmarksStore.getState().isBookmarked(vaultPath, path)
					: undefined,
			delete: (path, isDir) => actions.onDelete(path, isDir),
			copyFile: supportsNoteActions ? (path) => actions.onDuplicate(path) : undefined,
			copyPath: (path) => actions.onCopyPath(path, "absolute"),
			copyRelativePath: (path) => actions.onCopyPath(path, "relative"),
			showInExplorer: (path) => actions.onReveal(path),
			showVersionHistory: supportsNoteActions ? (path) => actions.onViewHistory(path) : undefined,
			toggleSyncIgnore:
				vaultPath && syncIgnoreToggleAvailable
					? (path, ignored) => {
							const relative = path.replace(`${vaultPath}/`, "")
							const normalized = node.isDir
								? relative.endsWith("/")
									? relative
									: `${relative}/`
								: relative
							useSyncStore.getState().toggleExcludedPath(normalized, ignored)
						}
					: undefined,
			isSyncIgnored:
				vaultPath && syncIgnoreToggleAvailable
					? (path) => {
							const relative = path.replace(`${vaultPath}/`, "")
							return useSyncStore.getState().isPathExcluded(relative)
						}
					: undefined,
		},
	)

	nativeMenu.showContextMenu({ items: [...items, ...pluginMenuItems], position })
}

function getTreeNodeVisualState(
	active: boolean,
	expanded: boolean,
	focused: boolean,
	renaming: boolean,
): TreeNodeVisualState {
	const key = (active ? 1 : 0) | (expanded ? 2 : 0) | (focused ? 4 : 0) | (renaming ? 8 : 0)
	return treeNodeVisualStates[key]
}

function getParentPath(path: string): string {
	return path.slice(0, path.lastIndexOf("/"))
}

const MemoizedTreeNodeView = memo(TreeNodeView)

const MemoizedTreeNodeRow = memo(TreeNodeRow)
