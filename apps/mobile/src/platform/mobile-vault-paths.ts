export interface MobileVaultPathParts {
	relativePath: string
	rootId: string
}

export const mobileVaultRootPrefix = "/mobile-vaults"

export function normalizeMobileVaultPath(path: string): string {
	const normalizedPath = path.replace(/\/+/gu, "/").replace(/\/$/u, "")
	return normalizedPath || "/"
}

export function createMobileVaultLogicalPath(rootId: string): string {
	return `${mobileVaultRootPrefix}/${rootId}`
}

export function isMobileVaultLogicalPath(path: string): boolean {
	const normalizedPath = normalizeMobileVaultPath(path)
	return (
		normalizedPath === mobileVaultRootPrefix ||
		normalizedPath.startsWith(`${mobileVaultRootPrefix}/`)
	)
}

export function getMobileVaultPathParts(path: string): MobileVaultPathParts | null {
	const normalizedPath = normalizeMobileVaultPath(path)
	if (!normalizedPath.startsWith(`${mobileVaultRootPrefix}/`)) return null

	const withoutPrefix = normalizedPath.slice(mobileVaultRootPrefix.length + 1)
	const [rootId, ...relativeSegments] = withoutPrefix.split("/")
	if (!rootId) return null

	return {
		relativePath: relativeSegments.join("/"),
		rootId,
	}
}

export function getMobileVaultRelativePath(path: string, rootPath: string): string {
	const normalizedPath = normalizeMobileVaultPath(path)
	const normalizedRootPath = normalizeMobileVaultPath(rootPath)
	if (normalizedPath === normalizedRootPath) return ""
	if (!normalizedPath.startsWith(`${normalizedRootPath}/`)) {
		throw new Error(`${path} is not inside ${rootPath}`)
	}

	return normalizedPath.slice(normalizedRootPath.length + 1)
}

export function joinMobileVaultPath(parentPath: string, childName: string): string {
	return normalizeMobileVaultPath(`${normalizeMobileVaultPath(parentPath)}/${childName}`)
}

export function isHiddenMobileVaultPath(path: string): boolean {
	return normalizeMobileVaultPath(path)
		.split("/")
		.some((segment) => segment.startsWith("."))
}
