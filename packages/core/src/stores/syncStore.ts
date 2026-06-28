import type {
	ConflictInfo,
	ConflictResolution,
	DeletedFileInfo,
	InitialSyncProgressEvent,
	SyncEngineState,
	SyncPreferences,
	VaultEncryptionStatus,
	VersionInfo,
} from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { notifyVaultSchemaChanged } from "@cortex/properties"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { useSubscriptionStore } from "./subscriptionStore"
import { useSyncLogStore } from "./syncLogStore"
import { getCurrentVaultPath, refreshCurrentVaultFiles } from "./vaultRuntime"

const syncImageExtensions = new Set([
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

interface SyncPathPattern {
	negated: boolean
	anchored: boolean
	directoryOnly: boolean
	hasSlash: boolean
	segments: string[]
}

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

export function isSyncImagePath(relativePath: string): boolean {
	const normalized = relativePath.replaceAll("\\", "/")
	const filename = normalized.split("/").at(-1) ?? normalized
	const dotIndex = filename.lastIndexOf(".")
	if (dotIndex < 0 || dotIndex === filename.length - 1) return false
	return syncImageExtensions.has(filename.slice(dotIndex + 1).toLowerCase())
}

export function normalizeSyncPathPattern(pattern: string): string {
	let normalized = pattern.replaceAll("\\", "/").trim()
	const negated = normalized.startsWith("!")
	if (negated) {
		normalized = normalized.slice(1).trim()
	}
	normalized = normalized.replace(/^\.\/+/, "").replace(/\/+/g, "/")
	if (!normalized || normalized === "/") return ""
	return `${negated ? "!" : ""}${normalized}`
}

function parseSyncPathPattern(pattern: string): SyncPathPattern | null {
	const normalized = normalizeSyncPathPattern(pattern)
	if (!normalized || normalized.startsWith("#")) return null

	const negated = normalized.startsWith("!")
	let value = negated ? normalized.slice(1) : normalized
	const anchored = value.startsWith("/")
	value = value.replace(/^\/+/, "")
	const directoryOnly = value.endsWith("/")
	value = value.replace(/\/+$/, "")
	if (!value) return null

	return {
		negated,
		anchored,
		directoryOnly,
		hasSlash: value.includes("/"),
		segments: value.split("/").filter(Boolean),
	}
}

function splitSyncPathSegments(path: string): string[] {
	const normalized = path.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+$/, "")
	if (!normalized) return []
	return normalized.split("/").filter(Boolean)
}

function segmentMatchesPattern(pattern: string, segment: string): boolean {
	const patternChars = Array.from(pattern)
	const segmentChars = Array.from(segment)
	const memo = new Map<string, boolean>()

	const matches = (patternIndex: number, segmentIndex: number): boolean => {
		const key = `${patternIndex}:${segmentIndex}`
		const cached = memo.get(key)
		if (cached !== undefined) return cached

		let result = false
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

function syncPathSegmentsMatch(
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
			for (let nextPathIndex = pathIndex; nextPathIndex <= pathSegments.length; nextPathIndex++) {
				if (matches(patternIndex + 1, nextPathIndex)) {
					result = true
					break
				}
			}
		} else if (pathIndex < pathSegments.length) {
			result =
				segmentMatchesPattern(patternSegments[patternIndex], pathSegments[pathIndex]) &&
				matches(patternIndex + 1, pathIndex + 1)
		}

		memo.set(key, result)
		return result
	}

	return matches(0, startIndex)
}

export function syncPathPatternMatches(relativePath: string, pattern: string): boolean {
	const parsed = parseSyncPathPattern(pattern)
	if (!parsed) return false

	const pathSegments = splitSyncPathSegments(relativePath)
	if (pathSegments.length === 0) return false

	const allowDescendants = parsed.directoryOnly || !parsed.hasSlash
	if (parsed.anchored || parsed.hasSlash) {
		return syncPathSegmentsMatch(parsed.segments, pathSegments, 0, allowDescendants)
	}

	for (let startIndex = 0; startIndex < pathSegments.length; startIndex++) {
		if (syncPathSegmentsMatch(parsed.segments, pathSegments, startIndex, allowDescendants)) {
			return true
		}
	}

	return false
}

function shouldIgnoreByExcludedPatterns(relativePath: string, patterns: string[]): boolean {
	let ignored = false
	for (const pattern of patterns) {
		const parsed = parseSyncPathPattern(pattern)
		if (parsed && syncPathPatternMatches(relativePath, pattern)) {
			ignored = !parsed.negated
		}
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
		...createDefaultSyncPreferences(),
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

export function shouldIgnoreSyncPath(relativePath: string, preferences: SyncPreferences): boolean {
	const normalized = relativePath.replaceAll("\\", "/")
	const filename = normalized.split("/").at(-1) ?? normalized
	if (filename === ".DS_Store" || filename === "Thumbs.db" || filename === "desktop.ini") {
		return true
	}

	const isCortex =
		normalized.includes("/.cortex/") ||
		normalized.endsWith("/.cortex") ||
		normalized.startsWith(".cortex/") ||
		normalized === ".cortex"

	if (!isCortex) {
		if (shouldIgnoreByExcludedPatterns(normalized, preferences.excludedPaths)) return true
		return preferences.ignoreImages && isSyncImagePath(normalized)
	}

	const cortexFile = normalized.includes("/.cortex/")
		? (normalized.split("/.cortex/").at(-1) ?? normalized)
		: normalized.startsWith(".cortex/")
			? normalized.slice(".cortex/".length)
			: normalized

	if (cortexFile === "schema/properties.json") return false

	if (
		cortexFile === "sync-preferences.json" ||
		cortexFile === "sync.db" ||
		cortexFile === "sync.db-wal" ||
		cortexFile === "sync.db-journal" ||
		cortexFile === "sync.db-shm"
	) {
		return true
	}

	if (cortexFile === "app.json") return !preferences.syncSettings
	if (cortexFile === "hotkeys.json") return !preferences.syncHotkeys
	if (cortexFile === "workspace.json") return !preferences.syncWorkspace
	if (cortexFile === "sync-plugins.json") return !preferences.syncPluginMetadata
	if (cortexFile === "sync-themes.json") return !preferences.syncThemeMetadata
	if (cortexFile === "bookmarks.json") return !preferences.syncBookmarks
	return true
}

export interface SyncState {
	engineState: SyncEngineState
	syncingFiles: Record<string, string>
	lastSyncedAt: number | null
	error: string | null
	unlisteners: Array<() => void>
	conflicts: Record<string, ConflictInfo>
	initialSyncProgress: InitialSyncProgressEvent | null
	initialSyncComplete: boolean
	vekRequired: boolean
	syncPreferences: SyncPreferences
	noteMetadataRevisions: Record<string, number>

	loadSyncPreferences: (vaultPath: string) => Promise<void>
	saveSyncPreferences: (vaultPath: string, preferences: SyncPreferences) => Promise<void>
	updateSyncPreference: (
		key: keyof Omit<SyncPreferences, "excludedPaths">,
		value: boolean,
	) => Promise<void>
	toggleExcludedPath: (relativePath: string, excluded: boolean) => Promise<void>
	isPathExcluded: (relativePath: string) => boolean
	startSync: (
		vaultId: string,
		vaultPath: string,
		serverUrl: string,
		requiresEntitlement: boolean,
	) => Promise<void>
	stopSync: () => Promise<void>
	forceSyncFile: (path: string) => Promise<void>
	resolveConflict: (path: string, resolution: ConflictResolution) => Promise<void>
	loadConflicts: (vaultId: string, vaultPath: string) => Promise<void>
	getVersionHistory: (
		vaultId: string,
		vaultPath: string,
		filePath: string,
	) => Promise<VersionInfo[]>
	downloadVersion: (
		vaultId: string,
		vaultPath: string,
		filePath: string,
		version: string,
	) => Promise<string>
	restoreVersion: (
		vaultId: string,
		vaultPath: string,
		filePath: string,
		version: string,
	) => Promise<void>
	listDeletedFiles: (vaultId: string, vaultPath: string) => Promise<DeletedFileInfo[]>
	restoreDeletedFile: (vaultId: string, vaultPath: string, filePath: string) => Promise<void>
	checkVaultEncryption: (vaultId: string) => Promise<VaultEncryptionStatus>
	createVaultKey: (vaultId: string, password: string) => Promise<void>
	unlockVaultKey: (vaultId: string, password: string) => Promise<void>
	subscribeEvents: () => Promise<void>
	unsubscribeEvents: () => void
}

export const useSyncStore = create<SyncState>()(
	devtools(
		immer((set, get) => ({
			engineState: "idle" as SyncEngineState,
			syncingFiles: {},
			lastSyncedAt: null,
			error: null,
			unlisteners: [],
			conflicts: {},
			initialSyncProgress: null,
			initialSyncComplete: false,
			vekRequired: false,
			syncPreferences: createDefaultSyncPreferences(),
			noteMetadataRevisions: {},

			loadSyncPreferences: async (vaultPath) => {
				const platform = getPlatform()
				const filePath = `${vaultPath}/.cortex/sync-preferences.json`
				try {
					const content = await platform.fs.readFile(filePath)
					const parsed = JSON.parse(content) as Partial<SyncPreferences>
					const prefs = normalizeSyncPreferences(parsed)
					set((state) => {
						state.syncPreferences = prefs
					})
					await platform.sync.updateSyncPreferences(prefs)
				} catch {
					const defaults = createDefaultSyncPreferences()
					set((state) => {
						state.syncPreferences = defaults
					})
					await platform.sync.updateSyncPreferences(defaults)
				}
			},

			saveSyncPreferences: async (vaultPath, preferences) => {
				const platform = getPlatform()
				const prefs = normalizeSyncPreferences(preferences)
				const filePath = `${vaultPath}/.cortex/sync-preferences.json`
				await platform.fs.writeFile(filePath, JSON.stringify(prefs, null, "\t"))
				set((state) => {
					state.syncPreferences = prefs
				})
				await platform.sync.updateSyncPreferences(prefs)
			},

			updateSyncPreference: async (key, value) => {
				const platform = getPlatform()
				set((state) => {
					;(state.syncPreferences as Record<string, unknown>)[key] = value
				})
				const prefs = get().syncPreferences
				const vaultPath = getCurrentVaultPath()
				if (vaultPath) {
					const filePath = `${vaultPath}/.cortex/sync-preferences.json`
					await platform.fs.writeFile(filePath, JSON.stringify(prefs, null, "\t"))
				}
				await platform.sync.updateSyncPreferences(prefs)
			},

			toggleExcludedPath: async (relativePath, excluded) => {
				const pattern = normalizeSyncPathPattern(relativePath)
				if (!pattern) return
				const platform = getPlatform()
				set((state) => {
					const paths = state.syncPreferences.excludedPaths
					if (excluded) {
						if (!paths.includes(pattern)) {
							paths.push(pattern)
						}
					} else {
						state.syncPreferences.excludedPaths = paths.filter((p) => p !== pattern)
					}
				})
				const prefs = get().syncPreferences
				const vaultPath = getCurrentVaultPath()
				if (vaultPath) {
					const filePath = `${vaultPath}/.cortex/sync-preferences.json`
					await platform.fs.writeFile(filePath, JSON.stringify(prefs, null, "\t"))
				}
				await platform.sync.updateSyncPreferences(prefs)
			},

			isPathExcluded: (relativePath) => {
				return shouldIgnoreSyncPath(relativePath, get().syncPreferences)
			},

			startSync: async (vaultId, vaultPath, serverUrl, requiresEntitlement) => {
				try {
					get().unsubscribeEvents()
					set((state) => {
						state.syncingFiles = {}
						state.initialSyncProgress = null
						state.initialSyncComplete = false
						state.noteMetadataRevisions = {}
						state.error = null
					})
					const platform = getPlatform()
					await Promise.all([get().loadSyncPreferences(vaultPath), get().subscribeEvents()])
					await platform.sync.start(vaultId, vaultPath, serverUrl, requiresEntitlement)
				} catch (e) {
					set((state) => {
						state.error = String(e)
					})
				}
			},

			stopSync: async () => {
				try {
					get().unsubscribeEvents()
					const platform = getPlatform()
					await platform.sync.stop()
					set((state) => {
						state.engineState = "idle"
						state.syncingFiles = {}
						state.conflicts = {}
						state.initialSyncProgress = null
						state.initialSyncComplete = false
						state.vekRequired = false
						state.noteMetadataRevisions = {}
					})
				} catch (e) {
					set((state) => {
						state.error = String(e)
					})
				}
			},

			forceSyncFile: async (path) => {
				try {
					const platform = getPlatform()
					await platform.sync.forceSyncFile(path)
				} catch (e) {
					set((state) => {
						state.error = String(e)
					})
				}
			},

			resolveConflict: async (path, resolution) => {
				try {
					const platform = getPlatform()
					await platform.sync.resolveConflict(path, resolution)
					set((state) => {
						delete state.conflicts[path]
					})
				} catch (e) {
					set((state) => {
						state.error = String(e)
					})
				}
			},

			loadConflicts: async (vaultId, vaultPath) => {
				try {
					const platform = getPlatform()
					const conflictList = await platform.sync.getConflicts(vaultId, vaultPath)
					set((state) => {
						state.conflicts = {}
						for (const conflict of conflictList) {
							state.conflicts[conflict.filePath] = conflict
						}
					})
				} catch (e) {
					set((state) => {
						state.error = String(e)
					})
				}
			},

			getVersionHistory: async (vaultId, vaultPath, filePath) => {
				const platform = getPlatform()
				return platform.sync.getVersionHistory(vaultId, vaultPath, filePath)
			},

			downloadVersion: async (vaultId, vaultPath, filePath, version) => {
				const platform = getPlatform()
				return platform.sync.downloadVersion(vaultId, vaultPath, filePath, version)
			},

			restoreVersion: async (vaultId, vaultPath, filePath, version) => {
				try {
					const platform = getPlatform()
					await platform.sync.restoreVersion(vaultId, vaultPath, filePath, version)
				} catch (e) {
					set((state) => {
						state.error = String(e)
					})
				}
			},

			listDeletedFiles: async (vaultId, vaultPath) => {
				const platform = getPlatform()
				return platform.sync.listDeletedFiles(vaultId, vaultPath)
			},

			restoreDeletedFile: async (vaultId, vaultPath, filePath) => {
				const platform = getPlatform()
				await platform.sync.restoreDeletedFile(vaultId, vaultPath, filePath)
				await refreshCurrentVaultFiles()
			},

			checkVaultEncryption: async (vaultId) => {
				const platform = getPlatform()
				return platform.sync.checkVaultEncryption(vaultId)
			},

			createVaultKey: async (vaultId, password) => {
				const platform = getPlatform()
				await platform.sync.createVaultKey(vaultId, password)
			},

			unlockVaultKey: async (vaultId, password) => {
				const platform = getPlatform()
				await platform.sync.unlockVaultKey(vaultId, password)
				set((state) => {
					state.vekRequired = false
				})
			},

			subscribeEvents: async () => {
				const platform = getPlatform()

				const [
					unlistenState,
					unlistenFile,
					unlistenProgress,
					unlistenConflict,
					unlistenComplete,
					unlistenVek,
					unlistenLog,
					unlistenDenied,
				] = await Promise.all([
					platform.sync.onStateChanged((event) => {
						set((state) => {
							state.engineState = event.state
							if (event.state === "live") {
								state.lastSyncedAt = Date.now()
								state.error = null
							}
						})
					}),
					platform.sync.onFileEvent((event) => {
						set((state) => {
							if (
								event.status === "synced" ||
								event.status === "merged" ||
								event.status === "deleted"
							) {
								delete state.syncingFiles[event.path]
								state.lastSyncedAt = Date.now()
								if (event.status !== "deleted") {
									state.noteMetadataRevisions[event.path] =
										(state.noteMetadataRevisions[event.path] ?? 0) + 1
								}
							} else if (event.status.startsWith("error:") || event.status === "conflict") {
								delete state.syncingFiles[event.path]
							} else {
								state.syncingFiles[event.path] = event.status
							}
						})

						if (
							event.path === ".cortex/schema/properties.json" &&
							(event.status === "synced" || event.status === "merged")
						) {
							const vaultPath = getCurrentVaultPath()
							if (vaultPath) notifyVaultSchemaChanged(vaultPath)
						}
					}),
					platform.sync.onInitialSyncProgress((event) => {
						set((state) => {
							state.initialSyncProgress = event
						})
					}),
					platform.sync.onConflict((event) => {
						set((state) => {
							state.conflicts[event.path] = {
								filePath: event.path,
								localHash: "",
								remoteHash: "",
								ancestorHash: null,
								localContent: null,
								remoteContent: null,
							}
						})
					}),
					platform.sync.onInitialSyncComplete(() => {
						set((state) => {
							state.initialSyncComplete = true
							state.initialSyncProgress = null
						})
					}),
					platform.sync.onVekRequired(() => {
						set((state) => {
							state.vekRequired = true
						})
					}),
					platform.sync.onSyncLog((event) => {
						const level =
							event.level === "error" ? "error" : event.level === "warn" ? "warn" : "info"
						useSyncLogStore.getState().log(level, event.message)
						if (level === "error") {
							set((state) => {
								state.error = event.message
							})
						}
					}),
					platform.sync.onVaultAccessDenied(async (event) => {
						set((state) => {
							state.engineState = "denied"
							state.error = event.reason
						})
						const logPrefix =
							event.kind === "subscription" ? "Sync plan validation failed" : "Vault access denied"
						useSyncLogStore.getState().log("error", `${logPrefix}: ${event.reason}`)
						if (event.kind === "vault") {
							const vaultPath = getCurrentVaultPath()
							if (vaultPath) {
								const { useRemoteVaultStore } = await import("./remoteVaultStore")
								await useRemoteVaultStore.getState().unlinkVault(vaultPath)
							}
						} else {
							useSubscriptionStore.setState({
								block: {
									code: event.code ?? "subscription_required",
									message: event.reason,
								},
							})
						}
					}),
				])

				set((state) => {
					state.unlisteners = [
						unlistenState,
						unlistenFile,
						unlistenProgress,
						unlistenConflict,
						unlistenComplete,
						unlistenVek,
						unlistenLog,
						unlistenDenied,
					]
				})
			},

			unsubscribeEvents: () => {
				const { unlisteners } = get()
				for (const unlisten of unlisteners) {
					unlisten()
				}
				set((state) => {
					state.unlisteners = []
				})
			},
		})),
		{ name: "syncStore" },
	),
)
