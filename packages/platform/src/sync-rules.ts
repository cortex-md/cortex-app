import type { SyncPreferences } from "./interfaces/Sync"
import { VAULT_CONFIG_DIR } from "./utils"

type SyncPreferenceFlag = Exclude<keyof SyncPreferences, "excludedPaths">

interface SyncPathPattern {
	negated: boolean
	anchored: boolean
	directoryOnly: boolean
	hasSlash: boolean
	segments: string[]
}

export const CORTEX_SYNCABLE_FILES: Readonly<Record<string, SyncPreferenceFlag>> = {
	"app.json": "syncSettings",
	"hotkeys.json": "syncHotkeys",
	"workspace.json": "syncWorkspace",
	"sync-plugins.json": "syncPluginMetadata",
	"sync-themes.json": "syncThemeMetadata",
	"bookmarks.json": "syncBookmarks",
}

const ALWAYS_SYNCED_CORTEX_FILES = new Set(["schema/properties.json", "inbox.md"])
const ALWAYS_SYNCED_CORTEX_DIRECTORIES = ["schema", "comments"] as const
const IGNORED_FILE_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"])
const SYNC_IMAGE_EXTENSIONS = new Set([
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

export function createDefaultSyncPreferences(): SyncPreferences {
	return {
		syncSettings: false,
		syncHotkeys: false,
		syncWorkspace: false,
		syncPluginMetadata: false,
		syncThemeMetadata: false,
		syncBookmarks: false,
		ignoreImages: false,
		excludedPaths: [],
	}
}

function normalizeSyncRelativePath(path: string): string {
	return path.replaceAll("\\", "/").replace(/^\/+/u, "")
}

function splitSyncPathSegments(path: string): string[] {
	return normalizeSyncRelativePath(path).split("/").filter(Boolean)
}

export function isSyncImagePath(relativePath: string): boolean {
	const filename = splitSyncPathSegments(relativePath).at(-1) ?? ""
	const dotIndex = filename.lastIndexOf(".")
	if (dotIndex < 0 || dotIndex === filename.length - 1) return false
	return SYNC_IMAGE_EXTENSIONS.has(filename.slice(dotIndex + 1).toLowerCase())
}

export function normalizeSyncPathPattern(pattern: string): string {
	let normalized = pattern.replaceAll("\\", "/").trim()
	const negated = normalized.startsWith("!")
	if (negated) normalized = normalized.slice(1).trim()
	normalized = normalized.replace(/^\.\/+/u, "").replace(/\/+/gu, "/")
	if (!normalized || normalized === "/") return ""
	return `${negated ? "!" : ""}${normalized}`
}

function parseSyncPathPattern(pattern: string): SyncPathPattern | null {
	const normalized = normalizeSyncPathPattern(pattern)
	if (!normalized || normalized.startsWith("#")) return null
	const negated = normalized.startsWith("!")
	let value = negated ? normalized.slice(1) : normalized
	const anchored = value.startsWith("/")
	value = value.replace(/^\/+/u, "")
	const directoryOnly = value.endsWith("/")
	value = value.replace(/\/+$/u, "")
	if (!value) return null
	return {
		negated,
		anchored,
		directoryOnly,
		hasSlash: value.includes("/"),
		segments: value.split("/").filter(Boolean),
	}
}

function segmentMatchesPattern(pattern: string, segment: string): boolean {
	const patternChars = Array.from(pattern)
	const segmentChars = Array.from(segment)
	const memo = new Map<string, boolean>()
	const matches = (patternIndex: number, segmentIndex: number): boolean => {
		const key = `${patternIndex}:${segmentIndex}`
		const cached = memo.get(key)
		if (cached !== undefined) return cached
		let result: boolean
		if (patternIndex === patternChars.length) {
			result = segmentIndex === segmentChars.length
		} else if (patternChars[patternIndex] === "*") {
			result =
				matches(patternIndex + 1, segmentIndex) ||
				(segmentIndex < segmentChars.length && matches(patternIndex, segmentIndex + 1))
		} else if (patternChars[patternIndex] === "?") {
			result = segmentIndex < segmentChars.length && matches(patternIndex + 1, segmentIndex + 1)
		} else {
			result =
				segmentIndex < segmentChars.length &&
				patternChars[patternIndex] === segmentChars[segmentIndex] &&
				matches(patternIndex + 1, segmentIndex + 1)
		}
		memo.set(key, result)
		return result
	}
	return matches(0, 0)
}

function segmentsMatch(
	patternSegments: string[],
	pathSegments: string[],
	startIndex: number,
	allowDescendants: boolean,
): boolean {
	const memo = new Map<string, boolean>()
	const matches = (patternIndex: number, pathIndex: number): boolean => {
		const key = `${patternIndex}:${pathIndex}`
		const cached = memo.get(key)
		if (cached !== undefined) return cached
		let result = false
		if (patternIndex === patternSegments.length) {
			result = allowDescendants || pathIndex === pathSegments.length
		} else if (patternSegments[patternIndex] === "**") {
			for (let next = pathIndex; next <= pathSegments.length && !result; next++) {
				result = matches(patternIndex + 1, next)
			}
		} else if (pathIndex < pathSegments.length) {
			result =
				segmentMatchesPattern(patternSegments[patternIndex] ?? "", pathSegments[pathIndex] ?? "") &&
				matches(patternIndex + 1, pathIndex + 1)
		}
		memo.set(key, result)
		return result
	}
	return matches(0, startIndex)
}

function parsedPatternMatches(pathSegments: string[], pattern: SyncPathPattern): boolean {
	if (pathSegments.length === 0) return false
	const allowDescendants = pattern.directoryOnly || !pattern.hasSlash
	if (pattern.anchored || pattern.hasSlash) {
		return segmentsMatch(pattern.segments, pathSegments, 0, allowDescendants)
	}
	for (let startIndex = 0; startIndex < pathSegments.length; startIndex++) {
		if (segmentsMatch(pattern.segments, pathSegments, startIndex, allowDescendants)) return true
	}
	return false
}

export function syncPathPatternMatches(relativePath: string, pattern: string): boolean {
	const parsed = parseSyncPathPattern(pattern)
	return parsed ? parsedPatternMatches(splitSyncPathSegments(relativePath), parsed) : false
}

function isExcludedByPatterns(relativePath: string, patterns: readonly string[]): boolean {
	const pathSegments = splitSyncPathSegments(relativePath)
	let ignored = false
	for (const pattern of patterns) {
		const parsed = parseSyncPathPattern(pattern)
		if (parsed && parsedPatternMatches(pathSegments, parsed)) ignored = !parsed.negated
	}
	return ignored
}

export function normalizeSyncPreferences(preferences: Partial<SyncPreferences>): SyncPreferences {
	const excludedPaths = Array.isArray(preferences.excludedPaths)
		? Array.from(
				new Set(
					preferences.excludedPaths.flatMap((pattern) => {
						const normalizedPattern = normalizeSyncPathPattern(pattern)
						return normalizedPattern ? [normalizedPattern] : []
					}),
				),
			)
		: []
	return {
		syncSettings: preferences.syncSettings ?? false,
		syncHotkeys: preferences.syncHotkeys ?? false,
		syncWorkspace: preferences.syncWorkspace ?? false,
		syncPluginMetadata: preferences.syncPluginMetadata ?? false,
		syncThemeMetadata: preferences.syncThemeMetadata ?? false,
		syncBookmarks: preferences.syncBookmarks ?? false,
		ignoreImages: preferences.ignoreImages ?? false,
		excludedPaths,
	}
}

function cortexRelativePath(path: string): string | null {
	if (path === VAULT_CONFIG_DIR || path.endsWith(`/${VAULT_CONFIG_DIR}`)) return ""
	if (path.startsWith(`${VAULT_CONFIG_DIR}/`)) return path.slice(VAULT_CONFIG_DIR.length + 1)
	const index = path.lastIndexOf(`/${VAULT_CONFIG_DIR}/`)
	return index >= 0 ? path.slice(index + VAULT_CONFIG_DIR.length + 2) : null
}

function isCommentsSidecar(cortexFile: string): boolean {
	return cortexFile.startsWith("comments/") && cortexFile.endsWith(".json")
}

function isAlwaysSyncedCortexDirectory(cortexFile: string): boolean {
	return ALWAYS_SYNCED_CORTEX_DIRECTORIES.some(
		(directory) =>
			cortexFile === directory || (directory === "comments" && cortexFile.startsWith("comments/")),
	)
}

export function shouldIgnoreSyncPath(relativePath: string, preferences: SyncPreferences): boolean {
	const path = normalizeSyncRelativePath(relativePath)
	if (!path) return false
	if (IGNORED_FILE_NAMES.has(path.split("/").at(-1) ?? "")) return true
	const cortexFile = cortexRelativePath(path)
	if (cortexFile === null) {
		if (isExcludedByPatterns(path, preferences.excludedPaths)) return true
		return preferences.ignoreImages && isSyncImagePath(path)
	}
	if (ALWAYS_SYNCED_CORTEX_FILES.has(cortexFile)) return false
	if (isCommentsSidecar(cortexFile)) return false
	const preference = CORTEX_SYNCABLE_FILES[cortexFile]
	return preference ? !preferences[preference] : true
}

export function shouldSkipSyncDirectory(
	relativePath: string,
	preferences: SyncPreferences,
): boolean {
	const path = normalizeSyncRelativePath(relativePath)
	const cortexFile = cortexRelativePath(path)
	if (cortexFile !== null) return cortexFile !== "" && !isAlwaysSyncedCortexDirectory(cortexFile)
	return isExcludedByPatterns(path, preferences.excludedPaths)
}
