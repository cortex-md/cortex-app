import { type FileTreeNode, type FileTreeVisibleNodeRow, getParentPath } from "@cortex/core"
import { type HotkeyBinding, matchesEvent, type ParsedHotkey, parseHotkey } from "@cortex/hotkeys"
import type { Virtualizer } from "@tanstack/react-virtual"
import { type KeyboardEvent, type RefObject, useCallback } from "react"
import { FILE_EXPLORER_COMMAND_IDS, type FileExplorerCommandId } from "./fileExplorerCommands"
import type { FileTreeActions } from "./useFileSidebarActions"

export interface FileExplorerHotkeyBinding {
	id: string
	keys: string
	enabled: boolean
	parsedKeys: ParsedHotkey
}

interface UseFileExplorerKeyboardOptions {
	activeFilePath: string | undefined
	expanded: Set<string>
	fileExplorerBindings: FileExplorerHotkeyBinding[]
	focusedPath: string | null
	nodeRows: FileTreeVisibleNodeRow[]
	nodeRowIndexByPath: Map<string, number>
	rowVirtualizer: Virtualizer<HTMLDivElement, Element>
	treeScrollRef: RefObject<HTMLDivElement | null>
	vimMode: boolean
	actions: FileTreeActions
}

const fileExplorerCommandIds = new Set<string>(Object.values(FILE_EXPLORER_COMMAND_IDS))

const fallbackFileExplorerBindings: FileExplorerHotkeyBinding[] = [
	{ id: FILE_EXPLORER_COMMAND_IDS.openMenu, keys: "shift+F10" },
	{ id: FILE_EXPLORER_COMMAND_IDS.rename, keys: "F2" },
	{ id: FILE_EXPLORER_COMMAND_IDS.delete, keys: "Delete" },
].map((binding) => ({ ...binding, enabled: true, parsedKeys: parseHotkey(binding.keys) }))

export function createFileExplorerHotkeyBindings(
	hotkeyBindings: HotkeyBinding[],
): FileExplorerHotkeyBinding[] {
	const bindings: FileExplorerHotkeyBinding[] = []
	for (const binding of hotkeyBindings) {
		if (binding.scope !== "file-explorer" || !fileExplorerCommandIds.has(binding.id)) continue
		bindings.push({ ...binding, parsedKeys: parseHotkey(binding.keys) })
	}
	return bindings
}

export function useFileExplorerKeyboard({
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
}: UseFileExplorerKeyboardOptions) {
	const focusedNodeIndex = focusedPath ? (nodeRowIndexByPath.get(focusedPath) ?? -1) : -1
	const focusedNode = focusedNodeIndex >= 0 ? nodeRows[focusedNodeIndex]?.node : null
	const effectiveBindings =
		fileExplorerBindings.length > 0 ? fileExplorerBindings : fallbackFileExplorerBindings

	const focusNodeAt = useCallback(
		(index: number) => {
			const target = nodeRows[index]
			if (!target) return
			actions.focusPath(target.node.path)
			rowVirtualizer.scrollToIndex(target.index, { align: "auto" })
		},
		[actions, nodeRows, rowVirtualizer],
	)

	const focusParent = useCallback(
		(node: FileTreeNode) => {
			const parentPath = getParentPath(node.path)
			const parentIndex = nodeRowIndexByPath.get(parentPath) ?? -1
			if (parentIndex >= 0) focusNodeAt(parentIndex)
		},
		[focusNodeAt, nodeRowIndexByPath],
	)

	const openNode = useCallback(
		(node: FileTreeNode) => {
			if (node.isDatabase) {
				actions.openDatabase(node.path, "reuse-active")
				if (!expanded.has(node.path)) actions.toggle(node.path)
			} else if (node.isDir) {
				actions.toggle(node.path)
			} else {
				actions.openFile(node.path, "reuse-active")
				treeScrollRef.current?.focus({ preventScroll: true })
			}
		},
		[actions, expanded, treeScrollRef],
	)

	const getCommandForEvent = useCallback(
		(event: KeyboardEvent<HTMLDivElement>): FileExplorerCommandId | null => {
			for (const binding of effectiveBindings) {
				if (!binding.enabled || !fileExplorerCommandIds.has(binding.id)) continue
				if (!matchesEvent(binding.parsedKeys, event.nativeEvent)) continue
				return binding.id as FileExplorerCommandId
			}
			return null
		},
		[effectiveBindings],
	)

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (isEditableEventTarget(event.target)) return

			const commandId = getCommandForEvent(event)
			if (commandId) {
				event.preventDefault()
				if (focusedNode) actions.runCommand(commandId, focusedNode)
				return
			}

			const key = event.key
			const navigateDown = key === "ArrowDown" || (vimMode && key === "j")
			const navigateUp = key === "ArrowUp" || (vimMode && key === "k")
			const navigateOpen = key === "ArrowRight" || (vimMode && key === "l")
			const navigateClose = key === "ArrowLeft" || (vimMode && key === "h")

			if (!focusedNode && nodeRows.length > 0) {
				if (
					navigateDown ||
					navigateUp ||
					navigateOpen ||
					navigateClose ||
					key === "Home" ||
					key === "End" ||
					key === "Enter"
				) {
					event.preventDefault()
					focusNodeAt(0)
				}
				return
			}
			if (!focusedNode || focusedNodeIndex < 0) return

			if (navigateDown) {
				event.preventDefault()
				focusNodeAt(Math.min(nodeRows.length - 1, focusedNodeIndex + 1))
				return
			}
			if (navigateUp) {
				event.preventDefault()
				focusNodeAt(Math.max(0, focusedNodeIndex - 1))
				return
			}
			if (key === "Home") {
				event.preventDefault()
				focusNodeAt(0)
				return
			}
			if (key === "End") {
				event.preventDefault()
				focusNodeAt(nodeRows.length - 1)
				return
			}
			if (key === "Enter") {
				event.preventDefault()
				openNode(focusedNode)
				return
			}
			if (navigateOpen) {
				event.preventDefault()
				if (focusedNode.isDir) {
					if (!expanded.has(focusedNode.path)) {
						actions.ensureExpanded(focusedNode.path)
					} else {
						const childIndex = nodeRows.findIndex(
							(row) => getParentPath(row.node.path) === focusedNode.path,
						)
						if (childIndex >= 0) focusNodeAt(childIndex)
					}
				} else if (vimMode) {
					openNode(focusedNode)
				}
				return
			}
			if (navigateClose) {
				event.preventDefault()
				if (focusedNode.isDir && expanded.has(focusedNode.path)) {
					actions.toggle(focusedNode.path)
				} else {
					focusParent(focusedNode)
				}
			}
		},
		[
			actions,
			expanded,
			focusNodeAt,
			focusParent,
			focusedNode,
			focusedNodeIndex,
			getCommandForEvent,
			nodeRows,
			openNode,
			vimMode,
		],
	)

	const handleFocus = useCallback(() => {
		const focusedIndex = focusedPath
			? nodeRows.findIndex((row) => row.node.path === focusedPath)
			: -1
		if (focusedIndex >= 0) {
			rowVirtualizer.scrollToIndex(nodeRows[focusedIndex].index, { align: "auto" })
			return
		}
		const activeIndex = activeFilePath
			? nodeRows.findIndex((row) => row.node.path === activeFilePath)
			: -1
		focusNodeAt(activeIndex >= 0 ? activeIndex : 0)
	}, [activeFilePath, focusNodeAt, focusedPath, nodeRows, rowVirtualizer])

	return { handleFocus, handleKeyDown }
}

function isEditableEventTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false
	if (target.isContentEditable) return true
	const tagName = target.tagName.toLowerCase()
	return tagName === "input" || tagName === "textarea" || tagName === "select"
}
