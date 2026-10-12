import { normalizePath } from "@cortex/platform/utils"

export interface MobileVaultPathParts {
	relativePath: string
	rootId: string
}

export const mobileVaultRootPrefix = "/mobile-vaults"

export function createMobileVaultLogicalPath(rootId: string): string {
	return `${mobileVaultRootPrefix}/${rootId}`
}

export function isMobileVaultLogicalPath(path: string): boolean {
	const normalizedPath = normalizePath(path)
	return (
		normalizedPath === mobileVaultRootPrefix ||
		normalizedPath.startsWith(`${mobileVaultRootPrefix}/`)
	)
}

export function getMobileVaultPathParts(path: string): MobileVaultPathParts | null {
	const normalizedPath = normalizePath(path)
	if (!normalizedPath.startsWith(`${mobileVaultRootPrefix}/`)) return null

	const withoutPrefix = normalizedPath.slice(mobileVaultRootPrefix.length + 1)
	const [rootId, ...relativeSegments] = withoutPrefix.split("/")
	if (!rootId) return null

	return {
		relativePath: relativeSegments.join("/"),
		rootId,
	}
}
