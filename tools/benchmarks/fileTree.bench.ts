import { bench } from "vitest"
import {
	buildFileTree,
	projectVisibleFileTree,
	type FileTreeNode,
	type FileTreeVisibleNodeRow,
} from "../../apps/desktop/src/features/file-explorer/fileTree"

function createEntries(fileCount: number) {
	const directoryCount = Math.ceil(fileCount / 100)
	return [
		...Array.from({ length: directoryCount }, (_, index) => ({
			path: `/vault/folder-${index}`,
			name: `folder-${index}`,
			isDir: true,
		})),
		...Array.from({ length: fileCount }, (_, index) => ({
			path: `/vault/folder-${Math.floor(index / 100)}/note-${index}.md`,
			name: `note-${index}.md`,
			isDir: false,
		})),
	]
}

function runSidebarClickBookkeeping(
	nodeRows: FileTreeVisibleNodeRow[],
	nodeByPath: Map<string, FileTreeNode>,
	nodeRowIndexByPath: Map<string, number>,
	activeFilePath: string,
	focusedPathOverride: string | null,
) {
	const focusedPath =
		focusedPathOverride && nodeByPath.has(focusedPathOverride)
			? focusedPathOverride
			: (activeFilePath && nodeByPath.has(activeFilePath)
					? activeFilePath
					: nodeRows[0]?.node.path) ??
				null
	const focusedNode = focusedPath ? (nodeByPath.get(focusedPath) ?? null) : null
	const focusedNodeIndex = focusedPath ? (nodeRowIndexByPath.get(focusedPath) ?? -1) : -1

	return `${focusedNode?.path ?? ""}:${focusedNodeIndex}`
}

for (const fileCount of [10_000, 50_000]) {
	const entries = createEntries(fileCount)
	bench(
		`File Explorer ${fileCount} entries`,
		() => {
			const tree = buildFileTree(entries, "/vault")
			const expanded = new Set(tree.slice(0, 20).map((node) => node.path))
			projectVisibleFileTree(tree, expanded, null, null)
		},
		{ iterations: 20 },
	)

	const tree = buildFileTree(entries, "/vault")
	const expanded = new Set(tree.map((node) => node.path))
	const projection = projectVisibleFileTree(tree, expanded, null, null)
	const activeFilePath = `/vault/folder-${Math.floor((fileCount - 1) / 100)}/note-${
		fileCount - 1
	}.md`

	bench(
		`File Explorer ${fileCount} visible row click bookkeeping`,
		() => {
			runSidebarClickBookkeeping(
				projection.nodeRows,
				projection.nodeByPath,
				projection.nodeRowIndexByPath,
				activeFilePath,
				activeFilePath,
			)
		},
		{ iterations: 50 },
	)
}
