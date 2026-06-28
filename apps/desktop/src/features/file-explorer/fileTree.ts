import type { FileEntry } from "@cortex/platform"

export interface FileTreeNode {
	name: string
	path: string
	isDir: boolean
	children: FileTreeNode[]
}

export interface FileTreeNodeRow {
	kind: "node"
	node: FileTreeNode
	depth: number
}

export interface FileTreeVisibleNodeRow {
	index: number
	node: FileTreeNode
	depth: number
}

export interface FileTreeCreateRow {
	kind: "create"
	parentPath: string
	depth: number
	createType: "file" | "folder"
}

export type FileTreeRow = FileTreeNodeRow | FileTreeCreateRow

export interface VisibleFileTreeProjection {
	rows: FileTreeRow[]
	nodeRows: FileTreeVisibleNodeRow[]
	nodeByPath: Map<string, FileTreeNode>
	nodeRowIndexByPath: Map<string, number>
}

function getParentPath(path: string): string {
	return path.slice(0, path.lastIndexOf("/"))
}

function normalizeTreePath(path: string): string {
	return path.replaceAll("\\", "/").replace(/\/+$/, "")
}

function sortNodes(nodes: FileTreeNode[]): void {
	nodes.sort((left, right) => {
		if (left.isDir !== right.isDir) return left.isDir ? -1 : 1
		return left.name.localeCompare(right.name)
	})
}

export function buildFileTree(entries: readonly FileEntry[], rootPath: string): FileTreeNode[] {
	const nodesByPath = new Map<string, FileTreeNode>()
	const childrenByParent = new Map<string, FileTreeNode[]>()
	const normalizedRootPath = normalizeTreePath(rootPath)

	for (const entry of entries) {
		const normalizedPath = normalizeTreePath(entry.path)
		const node: FileTreeNode = {
			name: entry.name,
			path: normalizedPath,
			isDir: entry.isDir,
			children: [],
		}
		nodesByPath.set(normalizedPath, node)
		const parentPath = getParentPath(normalizedPath)
		const siblings = childrenByParent.get(parentPath)
		if (siblings) siblings.push(node)
		else childrenByParent.set(parentPath, [node])
	}

	for (const node of nodesByPath.values()) {
		if (!node.isDir) continue
		node.children = childrenByParent.get(node.path) ?? []
		sortNodes(node.children)
	}

	const roots = childrenByParent.get(normalizedRootPath) ?? []
	sortNodes(roots)
	return roots
}

export function flattenVisibleFileTree(
	nodes: readonly FileTreeNode[],
	expanded: ReadonlySet<string>,
	creatingIn: string | null,
	creatingType: "file" | "folder" | null,
	depth = 0,
): FileTreeRow[] {
	return projectVisibleFileTree(nodes, expanded, creatingIn, creatingType, depth).rows
}

export function projectVisibleFileTree(
	nodes: readonly FileTreeNode[],
	expanded: ReadonlySet<string>,
	creatingIn: string | null,
	creatingType: "file" | "folder" | null,
	depth = 0,
): VisibleFileTreeProjection {
	const rows: FileTreeRow[] = []
	const nodeRows: FileTreeVisibleNodeRow[] = []
	const nodeByPath = new Map<string, FileTreeNode>()
	const nodeRowIndexByPath = new Map<string, number>()
	const stack: Array<{ node: FileTreeNode; depth: number }> = []
	for (let index = nodes.length - 1; index >= 0; index--) {
		const node = nodes[index]
		if (node) stack.push({ node, depth })
	}

	while (stack.length > 0) {
		const item = stack.pop()
		if (!item) continue
		const rowIndex = rows.length
		rows.push({ kind: "node", node: item.node, depth: item.depth })
		nodeRows.push({ index: rowIndex, node: item.node, depth: item.depth })
		nodeByPath.set(item.node.path, item.node)
		nodeRowIndexByPath.set(item.node.path, nodeRows.length - 1)
		if (!item.node.isDir || !expanded.has(item.node.path)) continue

		if (creatingIn === item.node.path && creatingType) {
			rows.push({
				kind: "create",
				parentPath: item.node.path,
				depth: item.depth + 1,
				createType: creatingType,
			})
		}

		for (let index = item.node.children.length - 1; index >= 0; index--) {
			const child = item.node.children[index]
			if (child) stack.push({ node: child, depth: item.depth + 1 })
		}
	}

	return { rows, nodeRows, nodeByPath, nodeRowIndexByPath }
}
