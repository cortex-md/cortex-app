import type { FileEntry } from "@cortex/platform"
import { getParentPath, isMarkdownPath, toVaultRelativePath } from "@cortex/platform/utils"

export interface FolderNoteCount {
	path: string
	noteCount: number
}

const folderCountsCache = new WeakMap<readonly FileEntry[], Map<string, FolderNoteCount[]>>()

export function getFolderNoteCounts(
	files: readonly FileEntry[],
	vaultPath: string,
): FolderNoteCount[] {
	const cachedByVault = folderCountsCache.get(files)
	const cached = cachedByVault?.get(vaultPath)
	if (cached) return cached
	const counts = new Map<string, number>()
	for (const file of files) {
		if (file.isDir) {
			const relative = toVaultRelativePath(file.path, vaultPath)
			if (relative && !relative.startsWith(".")) counts.set(relative, counts.get(relative) ?? 0)
			continue
		}
		if (!isMarkdownPath(file.path)) continue
		let folder = getParentPath(toVaultRelativePath(file.path, vaultPath) ?? "")
		while (folder && folder !== ".") {
			counts.set(folder, (counts.get(folder) ?? 0) + 1)
			const parent = getParentPath(folder)
			if (parent === folder) break
			folder = parent
		}
	}
	const result = [...counts.entries()]
		.map(([path, noteCount]) => ({ path, noteCount }))
		.sort((a, b) => a.path.localeCompare(b.path))
	const byVault = cachedByVault ?? new Map<string, FolderNoteCount[]>()
	byVault.set(vaultPath, result)
	folderCountsCache.set(files, byVault)
	return result
}
