import type { AlertDialogOptions, ConfirmDialogOptions } from "./interfaces/Dialog"

export const VAULT_CONFIG_DIR = ".cortex"

export const VAULT_FILES = {
	appSettings: `${VAULT_CONFIG_DIR}/app.json`,
	bookmarks: `${VAULT_CONFIG_DIR}/bookmarks.json`,
	comments: `${VAULT_CONFIG_DIR}/comments`,
	databaseRows: `${VAULT_CONFIG_DIR}/database-rows`,
	linkIndex: `${VAULT_CONFIG_DIR}/links-index.json`,
	propertySchema: `${VAULT_CONFIG_DIR}/schema/properties.json`,
	searchHistory: `${VAULT_CONFIG_DIR}/search-history.json`,
	searchIndex: `${VAULT_CONFIG_DIR}/search-index.json`,
	syncConfig: `${VAULT_CONFIG_DIR}/sync-config.json`,
	syncDb: `${VAULT_CONFIG_DIR}/sync.db`,
	syncPlugins: `${VAULT_CONFIG_DIR}/sync-plugins.json`,
	syncPreferences: `${VAULT_CONFIG_DIR}/sync-preferences.json`,
	syncThemes: `${VAULT_CONFIG_DIR}/sync-themes.json`,
	tagColors: `${VAULT_CONFIG_DIR}/tags.json`,
	tagIndex: `${VAULT_CONFIG_DIR}/tags-index.json`,
	taskInbox: `${VAULT_CONFIG_DIR}/inbox.md`,
	taskIndex: `${VAULT_CONFIG_DIR}/tasks-index.json`,
	templates: `${VAULT_CONFIG_DIR}/templates`,
	themes: `${VAULT_CONFIG_DIR}/themes`,
	vaultId: `${VAULT_CONFIG_DIR}/vault-id.json`,
	vaultMetadata: `${VAULT_CONFIG_DIR}/vault-metadata.json`,
	workspace: `${VAULT_CONFIG_DIR}/workspace.json`,
} as const

const PRESERVED_PATH_PREFIX = /^(?:[a-z][a-z\d+.-]*:\/\/|\/\/)/iu

export function normalizePath(path: string): string {
	const slashed = path.replaceAll("\\", "/")
	const prefix = PRESERVED_PATH_PREFIX.exec(slashed)?.[0] ?? ""
	const normalized = prefix + slashed.slice(prefix.length).replace(/\/{2,}/gu, "/")
	return normalized.length > 1 ? normalized.replace(/\/+$/u, "") : normalized
}

export function joinPath(parentPath: string, name: string): string {
	const parent = normalizePath(parentPath)
	if (!parent) return name
	return parent.endsWith("/") ? `${parent}${name}` : `${parent}/${name}`
}

export function getVaultFilePath(vaultPath: string, vaultRelativePath: string): string {
	return joinPath(vaultPath, vaultRelativePath)
}

export function getParentPath(path: string): string {
	const normalized = normalizePath(path)
	const index = normalized.lastIndexOf("/")
	return index === -1 ? "" : normalized.slice(0, index)
}

export function getBaseName(path: string): string {
	const normalized = normalizePath(path)
	return normalized.slice(normalized.lastIndexOf("/") + 1)
}

export function splitExtension(fileName: string): { baseName: string; extension: string } {
	const dotIndex = fileName.lastIndexOf(".")
	if (dotIndex <= 0) return { baseName: fileName, extension: "" }
	return { baseName: fileName.slice(0, dotIndex), extension: fileName.slice(dotIndex) }
}

export function getExtension(path: string): string {
	return splitExtension(getBaseName(path)).extension.slice(1).toLocaleLowerCase()
}

export function isMarkdownPath(path: string): boolean {
	return path.toLocaleLowerCase().endsWith(".md")
}

export function isPdfPath(path: string): boolean {
	return path.toLocaleLowerCase().endsWith(".pdf")
}

export function stripMarkdownExtension(fileName: string): string {
	return isMarkdownPath(fileName) ? fileName.slice(0, -3) : fileName
}

export function ensureMarkdownExtension(fileName: string): string {
	return isMarkdownPath(fileName) ? fileName : `${fileName}.md`
}

export function getNoteTitle(path: string): string {
	return stripMarkdownExtension(getBaseName(path))
}

export function isPathOrDescendant(path: string, parentPath: string): boolean {
	const normalizedPath = normalizePath(path)
	const normalizedParent = normalizePath(parentPath)
	if (normalizedPath === normalizedParent) return true
	const prefix = normalizedParent.endsWith("/") ? normalizedParent : `${normalizedParent}/`
	return normalizedPath.startsWith(prefix)
}

export function toVaultRelativePath(path: string, vaultPath: string): string | null {
	const normalizedPath = normalizePath(path)
	const normalizedVault = normalizePath(vaultPath)
	if (normalizedPath === normalizedVault) return ""
	const prefix = normalizedVault.endsWith("/") ? normalizedVault : `${normalizedVault}/`
	return normalizedPath.startsWith(prefix) ? normalizedPath.slice(prefix.length) : null
}

export function replacePathPrefix(path: string, oldPath: string, newPath: string): string | null {
	const relativePath = toVaultRelativePath(path, oldPath)
	if (relativePath === null) return null
	return relativePath ? joinPath(newPath, relativePath) : normalizePath(newPath)
}

export function getRelativePath(fromDirectoryPath: string, targetPath: string): string {
	const fromParts = normalizePath(fromDirectoryPath).split("/").filter(Boolean)
	const targetParts = normalizePath(targetPath).split("/").filter(Boolean)
	let commonLength = 0
	while (
		commonLength < fromParts.length &&
		commonLength < targetParts.length &&
		fromParts[commonLength] === targetParts[commonLength]
	) {
		commonLength += 1
	}
	const parents = fromParts.slice(commonLength).map(() => "..")
	const relative = [...parents, ...targetParts.slice(commonLength)].join("/")
	return relative || getBaseName(targetPath)
}

export async function mapWithConcurrency<T, R>(
	items: readonly T[],
	concurrency: number,
	worker: (item: T) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length)
	let nextIndex = 0
	const runNext = async (): Promise<void> => {
		const index = nextIndex
		nextIndex++
		if (index >= items.length) return
		results[index] = await worker(items[index])
		return runNext()
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runNext()))
	return results
}

export interface FileFingerprint {
	mtime: number
	size: number
}

const utf8Encoder = new TextEncoder()

export function getFileEntryFingerprint(entry: { mtime?: number; size?: number }): FileFingerprint {
	return { mtime: entry.mtime ?? 0, size: entry.size ?? 0 }
}

export function getContentFingerprint(content: string, modifiedAt: number): FileFingerprint {
	return { mtime: Math.floor(modifiedAt / 1000), size: utf8Encoder.encode(content).length }
}

export function hasSameFingerprint(
	left: FileFingerprint | undefined,
	right: FileFingerprint,
): boolean {
	return Boolean(left && left.mtime === right.mtime && left.size === right.size)
}

export function toMessageOptions<T extends ConfirmDialogOptions | AlertDialogOptions>(
	titleOrOptions: string | T,
	message?: string,
): T {
	return typeof titleOrOptions === "string"
		? ({ title: titleOrOptions, message: message ?? "" } as T)
		: titleOrOptions
}
