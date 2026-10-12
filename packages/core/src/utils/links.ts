import type { FileEntry } from "@cortex/platform"
import { isMarkdownPath, toVaultRelativePath } from "@cortex/platform/utils"

export type WikiLinkResolver = (target: string) => string | null

interface ResolverIndex {
	byRelativePath: Map<string, string>
	byName: Map<string, string>
}

const resolverCache = new WeakMap<readonly FileEntry[], Map<string, ResolverIndex>>()

function normalizeTarget(target: string): string {
	const trimmed = target
		.trim()
		.replaceAll("\\", "/")
		.replace(/^\.?\//, "")
	return (isMarkdownPath(trimmed) ? trimmed : `${trimmed}.md`).toLowerCase()
}

function getBaseName(relativePath: string): string {
	return relativePath.slice(relativePath.lastIndexOf("/") + 1)
}

function buildResolverIndex(files: readonly FileEntry[], vaultPath: string): ResolverIndex {
	const byRelativePath = new Map<string, string>()
	const byName = new Map<string, string>()
	const notes = files
		.filter((file) => !file.isDir && isMarkdownPath(file.path))
		.map((file) => ({
			path: file.path,
			relative: (toVaultRelativePath(file.path, vaultPath) ?? file.path).toLowerCase(),
		}))
		.sort((a, b) => a.relative.length - b.relative.length || a.relative.localeCompare(b.relative))
	for (const note of notes) {
		byRelativePath.set(note.relative, note.path)
		const name = getBaseName(note.relative)
		if (!byName.has(name)) byName.set(name, note.path)
	}
	return { byRelativePath, byName }
}

function getResolverIndex(files: readonly FileEntry[], vaultPath: string): ResolverIndex {
	let byVault = resolverCache.get(files)
	if (!byVault) {
		byVault = new Map()
		resolverCache.set(files, byVault)
	}
	let index = byVault.get(vaultPath)
	if (!index) {
		index = buildResolverIndex(files, vaultPath)
		byVault.set(vaultPath, index)
	}
	return index
}

export function createWikiLinkResolver(
	files: readonly FileEntry[],
	vaultPath: string,
): WikiLinkResolver {
	const index = getResolverIndex(files, vaultPath)
	return (target) => {
		const normalized = normalizeTarget(target)
		if (!normalized || normalized === ".md") return null
		const direct = index.byRelativePath.get(normalized)
		if (direct) return direct
		if (normalized.includes("/")) {
			for (const [relative, path] of index.byRelativePath) {
				if (relative.endsWith(`/${normalized}`)) return path
			}
		}
		return index.byName.get(getBaseName(normalized)) ?? null
	}
}
