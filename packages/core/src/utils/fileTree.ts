import type { FileEntry } from "@cortex/platform"
import {
	getParentPath,
	isPathOrDescendant,
	normalizePath,
	stripMarkdownExtension,
} from "@cortex/platform/utils"
import { canWriteVaultPath, canWriteVaultTree } from "../stores/accessStore"

export interface FileTreeNode {
	name: string
	path: string
	isDir: boolean
	children: FileTreeNode[]
	isDatabase?: boolean
}

export interface FileTreeOptions {
	hiddenPaths?: ReadonlySet<string>
	databaseFolderPaths?: ReadonlySet<string>
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

function sortNodes(nodes: FileTreeNode[]): void {
	nodes.sort((left, right) => {
		if (left.isDir !== right.isDir) return left.isDir ? -1 : 1
		return left.name.localeCompare(right.name)
	})
}

export function buildFileTree(
	entries: readonly FileEntry[],
	rootPath: string,
	options: FileTreeOptions = {},
): FileTreeNode[] {
	const nodesByPath = new Map<string, FileTreeNode>()
	const childrenByParent = new Map<string, FileTreeNode[]>()
	const normalizedRootPath = normalizePath(rootPath)

	for (const entry of entries) {
		const normalizedPath = normalizePath(entry.path)
		if (options.hiddenPaths?.has(normalizedPath)) continue
		const node: FileTreeNode = {
			name: entry.name,
			path: normalizedPath,
			isDir: entry.isDir,
			children: [],
		}
		if (entry.isDir && options.databaseFolderPaths?.has(normalizedPath)) node.isDatabase = true
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

export interface FileTreeViewRow {
	depth: number
	node: FileTreeNode
	title: string
}

export interface FileTreeViewModel {
	rows: FileTreeViewRow[]
	folderPaths: string[]
	allExpanded: boolean
}

export interface MovableEntry {
	path: string
	isDir: boolean
}

export interface MoveDestination {
	label: string
	path: string
}

export function getFileTreeNodeTitle(node: Pick<FileTreeNode, "name" | "isDir">): string {
	return node.isDir ? node.name : stripMarkdownExtension(node.name) || node.name
}

export function createFileTreeViewModel(
	files: readonly FileEntry[],
	vaultPath: string | null,
	expanded: ReadonlySet<string>,
	options: FileTreeOptions = {},
): FileTreeViewModel {
	const folderPaths = files.flatMap((file) => (file.isDir ? [file.path] : []))
	const rows = vaultPath
		? projectVisibleFileTree(
				buildFileTree(files, vaultPath, options),
				expanded,
				null,
				null,
			).nodeRows.map(({ depth, node }) => ({ depth, node, title: getFileTreeNodeTitle(node) }))
		: []
	return {
		rows,
		folderPaths,
		allExpanded: folderPaths.length > 0 && folderPaths.every((path) => expanded.has(path)),
	}
}

export function canMoveEntryTo(entry: MovableEntry, targetParentPath: string): boolean {
	const targetPath = normalizePath(targetParentPath)
	if (targetPath === getParentPath(entry.path) || targetPath === entry.path) return false
	if (entry.isDir && isPathOrDescendant(targetPath, entry.path)) return false
	return canWriteVaultTree(entry.path, entry.isDir) && canWriteVaultPath(targetPath, true)
}

export function getMoveDestinations(
	files: readonly FileEntry[],
	entry: MovableEntry | null,
	vault: { path: string; name: string } | null,
): MoveDestination[] {
	if (!entry || !vault) return []
	const destinations: MoveDestination[] = [
		{ label: vault.name, path: vault.path },
		...files.flatMap((file) =>
			file.isDir && file.path !== vault.path ? [{ label: file.name, path: file.path }] : [],
		),
	]
	return destinations.filter((destination) => canMoveEntryTo(entry, destination.path))
}
