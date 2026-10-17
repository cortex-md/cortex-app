import type { FileTreeNode, FileTreeRow, FileTreeVisibleNodeRow } from "@cortex/core"
import { getFileKind, getFileTreeNodeTitle, getParentPath, useDragStore } from "@cortex/core"
import { Button, Input, SimpleTooltip } from "@cortex/ui"
import type { Virtualizer } from "@tanstack/react-virtual"
import { ChevronRightIcon, FilePlusIcon, FolderIcon, FolderPlusIcon } from "lucide-react"
import { type MouseEvent, memo, type RefObject, useEffect, useRef } from "react"
import {
	DatabaseRowDot,
	DatabaseTreeRetainer,
	useIsDatabaseFolder,
} from "../databases/DatabaseTreeDecorations"
import { useInternalDragSource } from "../split-view/useInternalDragSource"
import { type FileExplorerHotkeyBinding, useFileExplorerKeyboard } from "./fileExplorerKeyboard"
import { DatabaseViewTile, getFileKindIcon } from "./fileKindIcon"
import { getFileTreeItemId } from "./fileTreeDom"
import { getFileTreeDepthStyle } from "./fileTreeLayout"
import type { FileTreeActions } from "./useFileSidebarActions"

const fileTreeAutoExpandDelayMs = 480

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
	actions: FileTreeActions
}

interface FileSidebarTreeRowsProps {
	rows: FileTreeRow[]
	activeFilePath: string | undefined
	focusedPath: string | null
	expanded: Set<string>
	renamingPath: string | null
	rowVirtualizer: Virtualizer<HTMLDivElement, Element>
	dropTarget: FileTreeDropTarget
	actions: FileTreeActions
}

export interface FileSidebarTreeProps extends Omit<FileSidebarTreeRowsProps, "dropTarget"> {
	tree: readonly FileTreeNode[]
	nodeRows: FileTreeVisibleNodeRow[]
	nodeRowIndexByPath: Map<string, number>
	isCreatingAtRoot: boolean
	vaultPath: string
	vimMode: boolean
	treeScrollRef: RefObject<HTMLDivElement | null>
	fileExplorerBindings: FileExplorerHotkeyBinding[]
}

type FileTreeDropTarget = ReturnType<typeof useDragStore.getState>["dropTarget"]

const treeNodeVisualStates = Array.from(
	{ length: 16 },
	(_, key): TreeNodeVisualState => ({
		active: Boolean(key & 1),
		expanded: Boolean(key & 2),
		focused: Boolean(key & 4),
		renaming: Boolean(key & 8),
	}),
)

function countNotes(node: FileTreeNode): number {
	return node.children.filter((child) => !child.isDir).length
}

function isChevronTarget(target: EventTarget | null): boolean {
	return target instanceof Element && Boolean(target.closest("[data-file-tree-chevron]"))
}

function isFileTreeItemContextTarget(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false
	return Boolean(
		target.closest(
			"[data-file-tree-path], .file-tree-create-row, input, textarea, [contenteditable='true']",
		),
	)
}

export function FileSidebarTree({
	tree,
	nodeRows,
	nodeRowIndexByPath,
	isCreatingAtRoot,
	vaultPath,
	vimMode,
	treeScrollRef,
	fileExplorerBindings,
	actions,
	...rowsProps
}: FileSidebarTreeProps) {
	const { expanded, focusedPath, activeFilePath, rowVirtualizer } = rowsProps
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
		actions,
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
			actions.ensureExpanded(autoExpandPath)
		}, fileTreeAutoExpandDelayMs)
	}, [actions, autoExpandPath, expanded])

	const rootDropActive = dropTarget?.type === "file-tree" && dropTarget.fileTreePosition === "root"

	const handleRootContextMenu = (event: MouseEvent<HTMLDivElement>) => {
		if (isFileTreeItemContextTarget(event.target)) return
		event.preventDefault()
		actions.showRootMenu({ x: event.clientX, y: event.clientY })
	}

	return (
		<div
			ref={treeScrollRef}
			className={`flex-1 overflow-y-auto px-1 pb-1 ${rootDropActive ? "file-tree-root-drop-active" : ""}`}
			role="tree"
			tabIndex={0}
			aria-activedescendant={focusedPath ? getFileTreeItemId(focusedPath) : undefined}
			data-file-tree-root-drop-target=""
			data-file-tree-root-path={vaultPath}
			onContextMenu={handleRootContextMenu}
			onFocus={handleFocus}
			onPointerDown={(event) => {
				delete event.currentTarget.dataset.keyboardNav
			}}
			onKeyDown={(event) => {
				event.currentTarget.dataset.keyboardNav = ""
				handleKeyDown(event)
			}}
		>
			{tree.length === 0 && !isCreatingAtRoot ? (
				<div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
					<FolderIcon className="size-6 text-text-muted" />
					<p className="m-0 text-xs text-text-muted">No files yet</p>
					<div className="flex items-center gap-2">
						<Button variant="secondary" onClick={() => actions.startCreate(vaultPath, "file")}>
							<FilePlusIcon className="size-3.5" />
							New note
						</Button>
						<Button variant="secondary" onClick={() => actions.startCreate(vaultPath, "folder")}>
							<FolderPlusIcon className="size-3.5" />
							New folder
						</Button>
					</div>
				</div>
			) : (
				<FileSidebarTreeRows {...rowsProps} actions={actions} dropTarget={dropTarget} />
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
	actions,
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
									<span className="file-tree-chevron-hit">
										<ChevronRightIcon size={14} strokeWidth={2.2} />
									</span>
								)}
								<InlineInput
									defaultValue={row.createType === "folder" ? "New Folder" : "Untitled"}
									onConfirm={(name) =>
										void actions.confirmCreate(row.parentPath, name, row.createType)
									}
									onCancel={actions.cancelCreate}
									selectBaseName={row.createType === "file"}
								/>
							</div>
						) : (
							<MemoizedTreeNodeRow
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
								actions={actions}
							/>
						)}
					</div>
				)
			})}
		</div>
	)
}

function TreeNodeRow({
	node,
	depth,
	visualState,
	parentPath,
	dropPosition,
	actions,
}: TreeNodeRowProps) {
	const parentIsDatabase = useIsDatabaseFolder(parentPath)
	const canDragEntry = !visualState.renaming
	const dragProps = useInternalDragSource(
		() => ({
			type: "file",
			filePath: node.path,
			isDirectory: node.isDir,
		}),
		{ disabled: !canDragEntry, onDropError: actions.reportDropError },
	)

	return (
		<Button
			size="sm"
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
			className={`file-tree-item flex items-center text-left w-full select-none outline-none ${
				visualState.active ? "active" : ""
			} ${visualState.focused ? "focused" : ""}`}
			{...dragProps}
			onClick={(event) => {
				if (visualState.renaming) return
				if (node.isDatabase && !isChevronTarget(event.target)) {
					actions.openDatabase(
						node.path,
						event.metaKey || event.ctrlKey ? "new-tab" : "reuse-active",
					)
					actions.focusPath(node.path)
					if (!visualState.expanded) actions.toggle(node.path)
					return
				}
				if (node.isDir) {
					actions.focusPath(node.path)
					actions.toggle(node.path)
					return
				}

				actions.openFile(node.path, event.metaKey || event.ctrlKey ? "new-tab" : "reuse-active")
				actions.focusPath(node.path)
			}}
			onContextMenu={(event) => {
				event.preventDefault()
				event.stopPropagation()
				actions.showEntryMenu(node, { x: event.clientX, y: event.clientY })
			}}
			onFocus={() => actions.focusPath(node.path)}
		>
			{node.isDir && (
				<span className="file-tree-chevron-hit" data-file-tree-chevron="">
					<ChevronRightIcon
						size={14}
						strokeWidth={2.2}
						className={visualState.expanded ? "rotate-90" : undefined}
					/>
				</span>
			)}
			{node.isDatabase && <DatabaseViewTile folderPath={node.path} />}
			{!node.isDir && <FileKindGlyph path={node.path} />}
			{node.isDatabase && visualState.expanded && <DatabaseTreeRetainer folderPath={node.path} />}
			{parentIsDatabase && !node.isDir && (
				<DatabaseRowDot folderPath={parentPath} path={node.path} />
			)}
			{visualState.renaming ? (
				<SimpleTooltip label={node.name} side="right">
					<InlineInput
						defaultValue={node.name}
						onConfirm={(newName) => void actions.confirmRename(node.path, newName)}
						onCancel={actions.cancelRename}
						selectBaseName={!node.isDir}
					/>
				</SimpleTooltip>
			) : (
				<span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">
					{getFileTreeNodeTitle(node)}
				</span>
			)}
			{node.isDatabase && !visualState.renaming && (
				<span className="file-tree-trail">{countNotes(node)}</span>
			)}
		</Button>
	)
}

function FileKindGlyph({ path }: { path: string }) {
	if (getFileKind(path) === "note") return null
	const Icon = getFileKindIcon(path)
	return (
		<span className="file-tree-kind-icon" aria-hidden="true">
			<Icon size={15} strokeWidth={2} />
		</span>
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

function getTreeNodeVisualState(
	active: boolean,
	expanded: boolean,
	focused: boolean,
	renaming: boolean,
): TreeNodeVisualState {
	const key = (active ? 1 : 0) | (expanded ? 2 : 0) | (focused ? 4 : 0) | (renaming ? 8 : 0)
	return treeNodeVisualStates[key]
}

const MemoizedTreeNodeRow = memo(TreeNodeRow)
