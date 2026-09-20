export interface SyncPreferences {
	syncSettings: boolean
	syncHotkeys: boolean
	syncWorkspace: boolean
	syncPluginMetadata: boolean
	syncThemeMetadata: boolean
	syncBookmarks: boolean
	ignoreImages: boolean
	excludedPaths: string[]
}

export const defaultSyncPreferences = (): SyncPreferences => ({
	syncSettings: false,
	syncHotkeys: false,
	syncWorkspace: false,
	syncPluginMetadata: false,
	syncThemeMetadata: false,
	syncBookmarks: false,
	ignoreImages: false,
	excludedPaths: [],
})

const IMAGE_EXTENSIONS = new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"avif",
	"bmp",
	"tif",
	"tiff",
	"heic",
	"heif",
	"ico",
	"svg",
])

export function isImagePath(path: string): boolean {
	const normalized = path.replaceAll("\\", "/")
	const filename = normalized.split("/").pop() ?? normalized
	const extension = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : null
	return extension ? IMAGE_EXTENSIONS.has(extension) : false
}

export function shouldIgnorePath(relativePath: string, preferences: SyncPreferences): boolean {
	const normalized = relativePath.replaceAll("\\", "/").replace(/^\/+/, "")
	if (!normalized) return false
	if (preferences.ignoreImages && isImagePath(normalized)) return true
	return preferences.excludedPaths.some((pattern) => matchesExcludePattern(normalized, pattern))
}

function matchesExcludePattern(path: string, pattern: string): boolean {
	const normalizedPattern = pattern.replaceAll("\\", "/").replace(/^\.\//, "").replace(/^\/+/, "")
	if (!normalizedPattern) return false
	if (normalizedPattern.endsWith("/")) {
		const directory = normalizedPattern.slice(0, -1)
		return path === directory || path.startsWith(`${directory}/`)
	}
	return path === normalizedPattern || path.startsWith(`${normalizedPattern}/`)
}
