import { bench } from "vitest"
import {
	buildFileTree,
	projectVisibleFileTree,
	type FileTreeNode,
	type FileTreeVisibleNodeRow,
} from "../../packages/core/src/utils/fileTree"
import { VaultIndex, type VaultIndexChange } from "../../packages/core/src/vault/vaultIndex"

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

function createNote(folderIndex: number, noteIndex: number) {
	return {
		path: `/vault/folder-${folderIndex}/added-${noteIndex}.md`,
		name: `added-${noteIndex}.md`,
		isDir: false,
		mtime: 1,
		size: 1,
	}
}

for (const fileCount of [10_000, 50_000]) {
	const entries = createEntries(fileCount)
	const folderCount = Math.ceil(fileCount / 100)

	for (const changeCount of [1, 100, 1000]) {
		const added = Array.from({ length: changeCount }, (_, index) =>
			createNote(index % folderCount, index),
		)
		const withAdded = [...entries, ...added]
		bench(
			`File tree ${fileCount} entries, ${changeCount} changes: full rebuild`,
			() => {
				const tree = buildFileTree(withAdded, "/vault")
				projectVisibleFileTree(tree, new Set(tree.slice(0, 20).map((node) => node.path)), null, null)
			},
			{ iterations: 20 },
		)

		const index = new VaultIndex("/vault", entries)
		const expanded = new Set(index.getRoots().slice(0, 20).map((node) => node.path))
		const addChanges: VaultIndexChange[] = added.map((entry) => ({ kind: "upsert", entry }))
		const removeChanges: VaultIndexChange[] = added.map((entry) => ({
			kind: "remove",
			path: entry.path,
		}))
		let present = false
		bench(
			`File tree ${fileCount} entries, ${changeCount} changes: VaultIndex apply`,
			() => {
				index.apply(present ? removeChanges : addChanges)
				present = !present
				projectVisibleFileTree(index.getRoots(), expanded, null, null)
			},
			{ iterations: 20 },
		)
	}

	const renameIndex = new VaultIndex("/vault", createEntries(fileCount))
	let renamed = false
	bench(
		`File tree ${fileCount} entries: rename folder with 100 notes (VaultIndex)`,
		() => {
			renameIndex.apply([
				renamed
					? { kind: "rename", from: "/vault/renamed", to: "/vault/folder-0" }
					: { kind: "rename", from: "/vault/folder-0", to: "/vault/renamed" },
			])
			renamed = !renamed
		},
		{ iterations: 20 },
	)

	const folderIndex = new VaultIndex(
		"/vault",
		[
			...Array.from({ length: 1000 }, (_, index) => ({
				path: `/vault/big/note-${index}.md`,
				name: `note-${index}.md`,
				isDir: false,
			})),
			{ path: "/vault/big", name: "big", isDir: true },
			...createEntries(fileCount),
		],
	)
	let folderRenamed = false
	bench(
		`File tree ${fileCount} entries: rename folder with 1k notes (VaultIndex)`,
		() => {
			folderIndex.apply([
				folderRenamed
					? { kind: "rename", from: "/vault/big-renamed", to: "/vault/big" }
					: { kind: "rename", from: "/vault/big", to: "/vault/big-renamed" },
			])
			folderRenamed = !folderRenamed
		},
		{ iterations: 20 },
	)

	const projectionIndex = new VaultIndex("/vault", createEntries(fileCount))
	const allExpanded = new Set(projectionIndex.getRoots().map((node) => node.path))
	bench(
		`File tree ${fileCount} entries: project all expanded folders from VaultIndex`,
		() => {
			projectVisibleFileTree(projectionIndex.getRoots(), allExpanded, null, null)
		},
		{ iterations: 20 },
	)
}

for (const fileCount of [10_000, 50_000]) {
	const entries = createEntries(fileCount)
	const flatRoot = Array.from({ length: fileCount }, (_, index) => ({
		path: `/vault/note-${index}.md`,
		name: `note-${index}.md`,
		isDir: false,
	}))
	bench(
		`File tree ${fileCount} entries: build VaultIndex (vault open)`,
		() => {
			new VaultIndex("/vault", entries)
		},
		{ iterations: 20 },
	)
	bench(
		`File tree ${fileCount} notes in the root: build VaultIndex (vault open)`,
		() => {
			new VaultIndex("/vault", flatRoot)
		},
		{ iterations: 20 },
	)
}
