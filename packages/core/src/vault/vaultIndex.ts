import type { FileEntry } from "@cortex/platform"
import {
	getBaseName,
	getFileEntryFingerprint,
	getFileNameSortKey,
	getParentPath,
	hasSameFingerprint,
	isPathOrDescendant,
	normalizePath,
} from "@cortex/platform/utils"
import type { FileTreeNode } from "../utils/fileTree"
import { fileEntryMtimeToMs } from "../utils/time"

export type VaultIndexChange =
	| { kind: "upsert"; entry: FileEntry }
	| { kind: "remove"; path: string }
	| { kind: "rename"; from: string; to: string }

export interface VaultIndexDelta {
	added: FileEntry[]
	removed: FileEntry[]
	modified: FileEntry[]
	changedFolders: string[]
	missingParents: string[]
}

const EMPTY_PATHS: readonly string[] = []
const EMPTY_ENTRIES: readonly FileEntry[] = []

function needsNormalize(path: string): boolean {
	return path.includes("\\") || path.includes("//") || path.endsWith("/")
}

function parentOf(path: string): string {
	const index = path.lastIndexOf("/")
	return index === -1 ? "" : path.slice(0, index)
}

interface SortableChild {
	path: string
	name: string
	isDir: boolean
	key: string
}

function compareSortableChildren(left: SortableChild, right: SortableChild): number {
	if (left.isDir !== right.isDir) return left.isDir ? -1 : 1
	if (left.key !== right.key) return left.key < right.key ? -1 : 1
	if (left.name !== right.name) return left.name < right.name ? -1 : 1
	return left.path < right.path ? -1 : left.path > right.path ? 1 : 0
}

function depthOf(path: string): number {
	let depth = 0
	for (let index = 0; index < path.length; index++) if (path[index] === "/") depth++
	return depth
}

function createDelta(): VaultIndexDelta {
	return { added: [], removed: [], modified: [], changedFolders: [], missingParents: [] }
}

export function isStructuralVaultIndexDelta(delta: VaultIndexDelta): boolean {
	return delta.added.length > 0 || delta.removed.length > 0 || delta.changedFolders.length > 0
}

export function isEmptyVaultIndexDelta(delta: VaultIndexDelta): boolean {
	return !isStructuralVaultIndexDelta(delta) && delta.modified.length === 0
}

export class VaultIndex {
	readonly rootPath: string
	private entries = new Map<string, FileEntry>()
	private readonly sortKeys = new Map<string, string>()
	private readonly children = new Map<string, string[]>()
	private readonly nodes = new Map<string, FileTreeNode>()
	private readonly folderVersions = new Map<string, number>()
	private readonly childEntriesCache = new Map<string, readonly FileEntry[]>()
	private hiddenPaths: ReadonlySet<string> = new Set()
	private databaseFolders: ReadonlySet<string> = new Set()
	private roots: FileTreeNode[] = []
	private treeVersionValue = 0
	private entryVersionValue = 0
	private filesSnapshot: FileEntry[] | null = null
	private modifiedTimesSnapshot: Map<string, number> | null = null
	private folderPathsSnapshot: string[] | null = null
	private dirty = new Set<string>()
	private ownedChildArrays = new Set<string>()
	private delta = createDelta()

	constructor(rootPath: string, entries: readonly FileEntry[] = EMPTY_ENTRIES) {
		this.rootPath = normalizePath(rootPath)
		this.children.set(this.rootPath, [])
		if (entries.length > 0) this.replaceAll(entries)
	}

	get treeVersion(): number {
		return this.treeVersionValue
	}

	get entryVersion(): number {
		return this.entryVersionValue
	}

	get size(): number {
		return this.entries.size
	}

	get(path: string): FileEntry | undefined {
		return this.entries.get(normalizePath(path))
	}

	has(path: string): boolean {
		return this.entries.has(normalizePath(path))
	}

	isFolder(path: string): boolean {
		const normalized = normalizePath(path)
		return normalized === this.rootPath || this.entries.get(normalized)?.isDir === true
	}

	getFolderVersion(path: string): number {
		return this.folderVersions.get(normalizePath(path)) ?? 0
	}

	getChildPaths(folderPath: string): readonly string[] {
		return this.children.get(normalizePath(folderPath)) ?? EMPTY_PATHS
	}

	getChildEntries(folderPath: string): readonly FileEntry[] {
		const folder = normalizePath(folderPath)
		const cached = this.childEntriesCache.get(folder)
		if (cached) return cached
		const paths = this.children.get(folder)
		if (!paths) return EMPTY_ENTRIES
		const entries: FileEntry[] = []
		for (const path of paths) {
			const entry = this.entries.get(path)
			if (entry) entries.push(entry)
		}
		this.childEntriesCache.set(folder, entries)
		return entries
	}

	getRoots(): readonly FileTreeNode[] {
		return this.roots
	}

	getNode(path: string): FileTreeNode | undefined {
		return this.nodes.get(normalizePath(path))
	}

	getFiles(): FileEntry[] {
		if (this.filesSnapshot) return this.filesSnapshot
		const files: FileEntry[] = []
		const stack = [...this.getChildPaths(this.rootPath)].reverse()
		while (stack.length > 0) {
			const path = stack.pop()
			if (path === undefined) continue
			const entry = this.entries.get(path)
			if (!entry) continue
			files.push(entry)
			if (!entry.isDir) continue
			const childPaths = this.children.get(path) ?? EMPTY_PATHS
			for (let index = childPaths.length - 1; index >= 0; index--) {
				const childPath = childPaths[index]
				if (childPath !== undefined) stack.push(childPath)
			}
		}
		this.filesSnapshot = files
		return files
	}

	getFolderPaths(): readonly string[] {
		if (this.folderPathsSnapshot) return this.folderPathsSnapshot
		this.folderPathsSnapshot = this.getFiles().flatMap((entry) => (entry.isDir ? [entry.path] : []))
		return this.folderPathsSnapshot
	}

	getModifiedTimes(): ReadonlyMap<string, number> {
		if (this.modifiedTimesSnapshot) return this.modifiedTimesSnapshot
		const times = new Map<string, number>()
		for (const entry of this.entries.values()) {
			const modifiedAt = entry.isDir ? null : fileEntryMtimeToMs(entry.mtime)
			if (modifiedAt) times.set(entry.path, modifiedAt)
		}
		this.modifiedTimesSnapshot = times
		return times
	}

	getModifiedTime(path: string): number | null {
		const entry = this.get(path)
		return entry && !entry.isDir ? fileEntryMtimeToMs(entry.mtime) : null
	}

	collectSubtree(folderPath: string): FileEntry[] {
		const root = normalizePath(folderPath)
		const result: FileEntry[] = []
		const stack = [...this.getChildPaths(root)].reverse()
		while (stack.length > 0) {
			const path = stack.pop()
			if (path === undefined) continue
			const entry = this.entries.get(path)
			if (!entry) continue
			result.push(entry)
			if (!entry.isDir) continue
			const childPaths = this.children.get(path) ?? EMPTY_PATHS
			for (let index = childPaths.length - 1; index >= 0; index--) {
				const childPath = childPaths[index]
				if (childPath !== undefined) stack.push(childPath)
			}
		}
		return result
	}

	apply(changes: readonly VaultIndexChange[]): VaultIndexDelta {
		const deferred: FileEntry[] = []
		for (const change of changes) {
			if (change.kind === "remove") this.removePath(change.path)
			else if (change.kind === "rename") deferred.push(...this.renamePath(change.from, change.to))
			else if (!this.upsertEntry(change.entry)) deferred.push(change.entry)
		}
		this.retryDeferred(deferred)
		return this.commit()
	}

	private retryDeferred(entries: FileEntry[]): void {
		let pending = entries
		while (pending.length > 0) {
			const next = pending.filter((entry) => !this.upsertEntry(entry))
			if (next.length === pending.length) break
			pending = next
		}
		for (const entry of pending) {
			const parent = getParentPath(normalizePath(entry.path))
			if (!this.delta.missingParents.includes(parent)) this.delta.missingParents.push(parent)
		}
	}

	replaceAll(entries: readonly FileEntry[]): VaultIndexDelta {
		const previous = this.entries
		const prefix = this.rootPath ? `${this.rootPath}/` : ""
		const next = new Map<string, FileEntry>()
		for (const entry of entries) {
			const path = needsNormalize(entry.path) ? normalizePath(entry.path) : entry.path
			if (path === this.rootPath || (prefix && !path.startsWith(prefix))) continue
			if (!next.has(path)) next.set(path, path === entry.path ? entry : { ...entry, path })
		}
		this.entries = next
		this.sortKeys.clear()
		this.children.clear()
		this.nodes.clear()
		this.childEntriesCache.clear()
		this.ownedChildArrays.clear()
		this.children.set(this.rootPath, [])
		for (const [path, entry] of next) {
			if (entry.isDir) this.children.set(path, [])
		}
		for (const [path, entry] of next) {
			const parent = parentOf(path)
			const siblings = this.children.get(parent)
			if (!siblings) {
				next.delete(path)
				continue
			}
			siblings.push(path)
			if (!entry.isDir) {
				this.nodes.set(path, { name: entry.name, path, isDir: false, children: [] })
			}
		}
		for (const [folder, childPaths] of this.children) {
			if (folder !== this.rootPath && !next.has(folder)) this.children.delete(folder)
			else if (childPaths.length > 1) this.children.set(folder, this.sortChildPaths(childPaths))
		}
		for (const folder of this.folderVersions.keys()) {
			if (!this.children.has(folder)) this.folderVersions.delete(folder)
		}
		for (const [path, old] of previous) {
			const current = next.get(path)
			if (!current || current.isDir !== old.isDir) this.delta.removed.push(old)
			else if (
				current.name !== old.name ||
				!hasSameFingerprint(getFileEntryFingerprint(old), getFileEntryFingerprint(current))
			) {
				this.delta.modified.push(current)
			}
		}
		for (const [path, current] of next) {
			const old = previous.get(path)
			if (!old || old.isDir !== current.isDir) this.delta.added.push(current)
		}
		for (const folder of this.children.keys()) this.dirty.add(folder)
		this.filesSnapshot = null
		this.folderPathsSnapshot = null
		return this.commit()
	}

	replaceSubtree(folderPath: string, entries: readonly FileEntry[]): VaultIndexDelta {
		const folder = normalizePath(folderPath)
		if (!this.isFolder(folder)) return this.commit()
		const next = new Map<string, FileEntry>()
		for (const entry of entries) {
			const path = normalizePath(entry.path)
			if (path === folder || !isPathOrDescendant(path, folder)) continue
			next.set(path, path === entry.path ? entry : { ...entry, path })
		}
		for (const entry of this.collectSubtree(folder)) {
			const replacement = next.get(entry.path)
			if (!this.entries.has(entry.path)) continue
			if (!replacement || replacement.isDir !== entry.isDir) this.removePath(entry.path)
		}
		const sorted = [...next.values()].sort(
			(left, right) => depthOf(left.path) - depthOf(right.path),
		)
		this.retryDeferred(sorted.filter((entry) => !this.upsertEntry(entry)))
		return this.commit()
	}

	setDatabaseViewNotes(viewNotePaths: readonly string[]): VaultIndexDelta {
		const hidden = new Set(viewNotePaths.map(normalizePath))
		const folders = new Set([...hidden].map(getParentPath))
		for (const path of hidden) if (!this.hiddenPaths.has(path)) this.markDirty(getParentPath(path))
		for (const path of this.hiddenPaths) if (!hidden.has(path)) this.markDirty(getParentPath(path))
		for (const folder of folders) if (!this.databaseFolders.has(folder)) this.markDirty(folder)
		for (const folder of this.databaseFolders) if (!folders.has(folder)) this.markDirty(folder)
		this.hiddenPaths = hidden
		this.databaseFolders = folders
		return this.commit()
	}

	private sortKeyOf(entry: FileEntry): string {
		let key = this.sortKeys.get(entry.path)
		if (key === undefined) {
			key = getFileNameSortKey(entry.name)
			this.sortKeys.set(entry.path, key)
		}
		return key
	}

	private sortChildPaths(childPaths: readonly string[]): string[] {
		const decorated: SortableChild[] = []
		for (const path of childPaths) {
			const entry = this.entries.get(path)
			if (entry)
				decorated.push({ path, name: entry.name, isDir: entry.isDir, key: this.sortKeyOf(entry) })
		}
		decorated.sort(compareSortableChildren)
		return decorated.map((child) => child.path)
	}

	private readonly comparePaths = (leftPath: string, rightPath: string): number => {
		const left = this.entries.get(leftPath)
		const right = this.entries.get(rightPath)
		if (!left || !right) return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0
		if (left.isDir !== right.isDir) return left.isDir ? -1 : 1
		const leftKey = this.sortKeyOf(left)
		const rightKey = this.sortKeyOf(right)
		if (leftKey !== rightKey) return leftKey < rightKey ? -1 : 1
		if (left.name !== right.name) return left.name < right.name ? -1 : 1
		return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0
	}

	private markDirty(folder: string): void {
		if (folder === this.rootPath || this.entries.get(folder)?.isDir) this.dirty.add(folder)
	}

	private ownChildArray(folder: string): string[] {
		const current = this.children.get(folder)
		if (current && this.ownedChildArrays.has(folder)) return current
		const owned = current ? current.slice() : []
		this.children.set(folder, owned)
		this.ownedChildArrays.add(folder)
		return owned
	}

	private findChildIndex(childPaths: readonly string[], path: string): number {
		let low = 0
		let high = childPaths.length
		while (low < high) {
			const middle = (low + high) >>> 1
			const current = childPaths[middle]
			if (current !== undefined && this.comparePaths(current, path) < 0) low = middle + 1
			else high = middle
		}
		return low
	}

	private insertChild(folder: string, path: string): void {
		const childPaths = this.ownChildArray(folder)
		childPaths.splice(this.findChildIndex(childPaths, path), 0, path)
		this.dirty.add(folder)
	}

	private removeChild(folder: string, path: string): void {
		const current = this.children.get(folder)
		if (!current) return
		const childPaths = this.ownChildArray(folder)
		let index = this.findChildIndex(childPaths, path)
		if (childPaths[index] !== path) index = childPaths.indexOf(path)
		if (index >= 0) childPaths.splice(index, 1)
		this.dirty.add(folder)
	}

	private upsertEntry(input: FileEntry): boolean {
		const path = normalizePath(input.path)
		if (path === this.rootPath || !isPathOrDescendant(path, this.rootPath)) return true
		const entry = path === input.path ? input : { ...input, path }
		const existing = this.entries.get(path)
		if (existing) {
			if (existing.isDir !== entry.isDir) {
				this.removePath(path)
			} else {
				if (
					existing.name !== entry.name ||
					!hasSameFingerprint(getFileEntryFingerprint(existing), getFileEntryFingerprint(entry))
				) {
					this.entries.set(path, entry)
					this.sortKeys.delete(path)
					this.childEntriesCache.delete(getParentPath(path))
					this.delta.modified.push(entry)
				}
				return true
			}
		}
		const parent = getParentPath(path)
		if (!this.isFolder(parent)) return false
		this.entries.set(path, entry)
		if (entry.isDir) {
			if (!this.children.has(path)) this.children.set(path, [])
			this.dirty.add(path)
		} else {
			this.nodes.set(path, { name: entry.name, path, isDir: false, children: [] })
		}
		this.insertChild(parent, path)
		this.delta.added.push(entry)
		return true
	}

	private removePath(inputPath: string): void {
		const path = normalizePath(inputPath)
		const entry = this.entries.get(path)
		if (!entry) return
		const stack = [path]
		while (stack.length > 0) {
			const current = stack.pop()
			if (current === undefined) continue
			const currentEntry = this.entries.get(current)
			if (!currentEntry) continue
			if (currentEntry.isDir) {
				for (const childPath of this.children.get(current) ?? EMPTY_PATHS) stack.push(childPath)
				this.children.delete(current)
				this.ownedChildArrays.delete(current)
				this.childEntriesCache.delete(current)
				this.folderVersions.delete(current)
			}
			this.entries.delete(current)
			this.sortKeys.delete(current)
			this.nodes.delete(current)
			this.delta.removed.push(currentEntry)
		}
		this.removeChild(getParentPath(path), path)
	}

	private renamePath(fromPath: string, toPath: string): FileEntry[] {
		const from = normalizePath(fromPath)
		const to = normalizePath(toPath)
		const entry = this.entries.get(from)
		if (!entry || from === to) return []
		const moved = [entry, ...(entry.isDir ? this.collectSubtree(from) : [])]
		this.removePath(from)
		const deferred: FileEntry[] = []
		for (const item of moved) {
			const path = item.path === from ? to : `${to}${item.path.slice(from.length)}`
			const next = { ...item, path, name: item.path === from ? getBaseName(to) : item.name }
			if (!this.upsertEntry(next)) deferred.push(next)
		}
		return deferred
	}

	private buildChildNodes(folder: string): FileTreeNode[] {
		const nodes: FileTreeNode[] = []
		for (const path of this.children.get(folder) ?? EMPTY_PATHS) {
			if (this.hiddenPaths.has(path)) continue
			const node = this.nodes.get(path)
			if (node) nodes.push(node)
		}
		return nodes
	}

	private commit(): VaultIndexDelta {
		const delta = this.delta
		this.delta = createDelta()
		this.ownedChildArrays.clear()
		const dirtyFolders = this.dirty
		this.dirty = new Set()
		if (delta.modified.length > 0 || delta.added.length > 0 || delta.removed.length > 0) {
			this.entryVersionValue++
			this.modifiedTimesSnapshot = null
		}
		if (dirtyFolders.size === 0 && delta.added.length === 0 && delta.removed.length === 0) {
			return delta
		}
		const rebuild = new Set<string>()
		for (const folder of dirtyFolders) {
			let current = folder
			while (current !== this.rootPath && current && !rebuild.has(current)) {
				rebuild.add(current)
				const parent = getParentPath(current)
				if (parent === current) break
				current = parent
			}
		}
		const ordered = [...rebuild].sort((left, right) => depthOf(right) - depthOf(left))
		for (const folder of ordered) {
			const entry = this.entries.get(folder)
			if (!entry?.isDir) continue
			const node: FileTreeNode = {
				name: entry.name,
				path: folder,
				isDir: true,
				children: this.buildChildNodes(folder),
			}
			if (this.databaseFolders.has(folder)) node.isDatabase = true
			this.nodes.set(folder, node)
		}
		this.roots = this.buildChildNodes(this.rootPath)
		for (const folder of dirtyFolders) {
			this.childEntriesCache.delete(folder)
			if (folder === this.rootPath || this.children.has(folder)) {
				this.folderVersions.set(folder, (this.folderVersions.get(folder) ?? 0) + 1)
			}
		}
		delta.changedFolders = [...dirtyFolders]
		if (delta.added.length > 0 || delta.removed.length > 0) {
			this.filesSnapshot = null
			this.folderPathsSnapshot = null
		}
		this.treeVersionValue++
		return delta
	}
}
