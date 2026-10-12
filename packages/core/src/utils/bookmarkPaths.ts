import { isMarkdownPath, isPathOrDescendant, VAULT_CONFIG_DIR } from "@cortex/platform/utils"

type BookmarkPathMode = "bookmark" | "reference"

export function normalizeSlashes(path: string): string {
	return path.replaceAll("\\", "/").replace(/\/+/g, "/")
}

export function trimPathBoundary(path: string): string {
	return path
		.replace(/^\.\/+/, "")
		.replace(/^\/+/, "")
		.replace(/\/+$/, "")
}

function isAbsolutePath(path: string): boolean {
	return path.startsWith("/") || /^[A-Za-z]:\//.test(path)
}

export function normalizeVaultRoot(vaultPath: string): string {
	return normalizeSlashes(vaultPath).replace(/\/+$/, "")
}

export function normalizeBookmarkPath(
	vaultPath: string,
	filePath: string,
	mode: BookmarkPathMode = "bookmark",
): string | null {
	const vaultRoot = normalizeVaultRoot(vaultPath)
	const normalizedPath = normalizeSlashes(filePath.trim())
	const relativePath =
		normalizedPath === vaultRoot
			? ""
			: normalizedPath.startsWith(`${vaultRoot}/`)
				? normalizedPath.slice(vaultRoot.length + 1)
				: isAbsolutePath(normalizedPath)
					? ""
					: trimPathBoundary(normalizedPath)

	if (!relativePath) return null
	const normalizedRelativePath = trimPathBoundary(normalizeSlashes(relativePath))
	if (!normalizedRelativePath || isPathOrDescendant(normalizedRelativePath, VAULT_CONFIG_DIR))
		return null
	const segments = normalizedRelativePath.split("/")
	if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null
	if (mode === "bookmark" && !isMarkdownPath(normalizedRelativePath)) {
		return null
	}
	return normalizedRelativePath
}

/** Plugin-facing bookmark path: throws when no vault is open or the path is not a vault note. */
export function requireBookmarkPath(
	vaultPath: string | null | undefined,
	path: string,
): { vaultPath: string; bookmarkPath: string } {
	if (!vaultPath) throw new Error("No vault is open")
	const bookmarkPath = normalizeBookmarkPath(vaultPath, path)
	if (!bookmarkPath) {
		throw new Error("Bookmarks only support Markdown files inside the active vault")
	}
	return { vaultPath, bookmarkPath }
}
