import type { useVaultStore } from "@cortex/core"
import { type Rect, useVirtualizer, type Virtualizer } from "@tanstack/react-virtual"
import { type RefObject, useMemo } from "react"
import {
	buildFileTree,
	type FileTreeNode,
	type FileTreeRow,
	type FileTreeVisibleNodeRow,
	projectVisibleFileTree,
} from "./fileTree"
import { FILE_TREE_ROW_STEP } from "./fileTreeLayout"

type VaultFiles = ReturnType<typeof useVaultStore.getState>["files"]

interface FileSidebarTreeModelOptions {
	files: VaultFiles
	vaultPath: string
	hasVault: boolean
	expanded: Set<string>
	creatingIn: string | null
	creatingType: "file" | "folder" | null
	activeFilePath: string | undefined
	focusedPathOverride: string | null
	treeScrollRef: RefObject<HTMLDivElement | null>
}

interface FileSidebarTreeModel {
	tree: FileTreeNode[]
	rows: FileTreeRow[]
	nodeRows: FileTreeVisibleNodeRow[]
	nodeRowIndexByPath: Map<string, number>
	focusedPath: string | null
	focusedNode: FileTreeNode | null
	rowVirtualizer: Virtualizer<HTMLDivElement, Element>
}

export function useFileSidebarTreeModel({
	files,
	vaultPath,
	hasVault,
	expanded,
	creatingIn,
	creatingType,
	activeFilePath,
	focusedPathOverride,
	treeScrollRef,
}: FileSidebarTreeModelOptions): FileSidebarTreeModel {
	const tree = useMemo(() => buildFileTree(files, vaultPath), [files, vaultPath])
	const projection = useMemo(() => {
		if (!hasVault) {
			return {
				rows: [],
				nodeRows: [],
				nodeByPath: new Map<string, FileTreeNode>(),
				nodeRowIndexByPath: new Map<string, number>(),
			}
		}
		const visibleProjection = projectVisibleFileTree(tree, expanded, creatingIn, creatingType)
		if (creatingIn !== vaultPath || !creatingType) return visibleProjection
		return {
			rows: [
				{
					kind: "create",
					parentPath: vaultPath,
					depth: 0,
					createType: creatingType,
				},
				...visibleProjection.rows,
			] as FileTreeRow[],
			nodeRows: visibleProjection.nodeRows.map((row) => ({ ...row, index: row.index + 1 })),
			nodeByPath: visibleProjection.nodeByPath,
			nodeRowIndexByPath: visibleProjection.nodeRowIndexByPath,
		}
	}, [creatingIn, creatingType, expanded, hasVault, tree, vaultPath])
	const rows = projection.rows
	const nodeRows = projection.nodeRows
	const nodeRowIndexByPath = projection.nodeRowIndexByPath
	const focusedPath = useMemo(() => {
		if (focusedPathOverride && projection.nodeByPath.has(focusedPathOverride)) {
			return focusedPathOverride
		}
		if (activeFilePath && projection.nodeByPath.has(activeFilePath)) return activeFilePath
		return nodeRows[0]?.node.path ?? null
	}, [activeFilePath, focusedPathOverride, nodeRows, projection.nodeByPath])
	const focusedNode = useMemo(
		() => (focusedPath ? (projection.nodeByPath.get(focusedPath) ?? null) : null),
		[focusedPath, projection.nodeByPath],
	)
	const rowVirtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => treeScrollRef.current,
		estimateSize: () => FILE_TREE_ROW_STEP,
		overscan: 8,
		initialRect: { width: 320, height: 600 },
		observeElementRect: observeTreeElementRect,
		getItemKey: (index) => {
			const row = rows[index]
			return row?.kind === "node"
				? row.node.path
				: `${row?.parentPath ?? "root"}:${row?.createType ?? "create"}`
		},
	})

	return { tree, rows, nodeRows, nodeRowIndexByPath, focusedPath, focusedNode, rowVirtualizer }
}

function observeTreeElementRect(
	instance: Virtualizer<HTMLDivElement, Element>,
	callback: (rect: Rect) => void,
): () => void {
	const element = instance.scrollElement
	const update = () => {
		callback({
			width: element?.clientWidth || 320,
			height: element?.clientHeight || 600,
		})
	}
	update()
	if (!element || typeof ResizeObserver === "undefined") return () => undefined
	const observer = new ResizeObserver(update)
	observer.observe(element)
	return () => observer.disconnect()
}
