export function normalizePathSeparators(path: string): string {
	return path.replaceAll("\\", "/")
}

export function normalizeRelativePath(path: string): string {
	return normalizePathSeparators(path).replace(/^\/+/, "")
}

export function toVaultRelativePath(vaultPath: string, path: string): string {
	const normalizedPath = normalizePathSeparators(path)
	const normalizedVault = normalizePathSeparators(vaultPath).replace(/\/+$/, "")
	const prefix = `${normalizedVault}/`
	if (normalizedPath.startsWith(prefix)) {
		return normalizeRelativePath(normalizedPath.slice(prefix.length))
	}
	if (normalizedPath === normalizedVault) return ""
	return normalizedPath
}
