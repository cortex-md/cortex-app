import type {
	ConflictInfo,
	ConflictResolution,
	DeletedFileInfo,
	InitialSyncProgressEvent,
	KeyTrustIssue,
	SyncEngineState,
	SyncFileEvent,
	SyncPreferences,
	VaultEncryptionStatus,
	VaultKeyRequestResult,
	VersionInfo,
} from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
	createDefaultSyncPreferences,
	normalizeSyncPathPattern,
	normalizeSyncPreferences,
	shouldIgnoreSyncPath,
} from "@cortex/platform/sync-rules"
import { VAULT_FILES } from "@cortex/platform/utils"
import { notifyVaultSchemaChanged } from "@cortex/properties"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { getVaultSyncState } from "../vault/vaultStateFiles"
import { useAccessStore } from "./accessStore"
import { useSubscriptionStore } from "./subscriptionStore"
import { useSyncLogStore } from "./syncLogStore"
import { getCurrentVaultPath, refreshCurrentVaultFiles } from "./vaultRuntime"

export { isSyncImagePath } from "@cortex/platform/sync-rules"
export {
	createDefaultSyncPreferences,
	normalizeSyncPathPattern,
	normalizeSyncPreferences,
	shouldIgnoreSyncPath,
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
	keyTrustIssues: KeyTrustIssue[]
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
	restartSync: () => Promise<void>
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
	createVaultKey: (vaultId: string) => Promise<void>
	requestVaultKey: (vaultId: string) => Promise<VaultKeyRequestResult>
	unlockVaultKey: (vaultId: string, password: string) => Promise<void>
	loadKeyTrustIssues: (vaultId: string) => Promise<void>
	trustMemberKey: (vaultId: string, userId: string, fingerprint: string) => Promise<void>
	subscribeEvents: () => Promise<void>
	unsubscribeEvents: () => void
}

let lastSyncStart: {
	vaultId: string
	vaultPath: string
	serverUrl: string
	requiresEntitlement: boolean
} | null = null

export function writeSyncPreferences(
	vaultPath: string,
	preferences: SyncPreferences,
): Promise<void> {
	return getVaultSyncState(vaultPath).update(
		(state) => ({ ...state, preferences: { ...preferences } }),
		{ immediate: true },
	)
}

const VAULT_KEY_RETRY_MS = 15_000
const FILE_EVENT_BATCH_MS = 50
let vaultKeyRetryTimer: ReturnType<typeof setTimeout> | null = null

function clearVaultKeyRetry(): void {
	if (vaultKeyRetryTimer) clearTimeout(vaultKeyRetryTimer)
	vaultKeyRetryTimer = null
}

function upsertKeyTrustIssue(issues: KeyTrustIssue[], issue: KeyTrustIssue): void {
	const index = issues.findIndex(
		(candidate) => candidate.vaultId === issue.vaultId && candidate.userId === issue.userId,
	)
	if (index === -1) issues.push(issue)
	else issues[index] = issue
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
			keyTrustIssues: [],
			syncPreferences: createDefaultSyncPreferences(),
			noteMetadataRevisions: {},

			loadSyncPreferences: async (vaultPath) => {
				const platform = getPlatform()
				const { preferences } = await getVaultSyncState(vaultPath).read()
				const prefs = preferences
					? normalizeSyncPreferences(preferences as Partial<SyncPreferences>)
					: createDefaultSyncPreferences()
				set((state) => {
					state.syncPreferences = prefs
				})
				await platform.sync.updateSyncPreferences(prefs)
			},

			saveSyncPreferences: async (vaultPath, preferences) => {
				const platform = getPlatform()
				const prefs = normalizeSyncPreferences(preferences)
				await writeSyncPreferences(vaultPath, prefs)
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
				if (vaultPath) await writeSyncPreferences(vaultPath, prefs)
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
				if (vaultPath) await writeSyncPreferences(vaultPath, prefs)
				await platform.sync.updateSyncPreferences(prefs)
			},

			isPathExcluded: (relativePath) => {
				return shouldIgnoreSyncPath(relativePath, get().syncPreferences)
			},

			startSync: async (vaultId, vaultPath, serverUrl, requiresEntitlement) => {
				lastSyncStart = { vaultId, vaultPath, serverUrl, requiresEntitlement }
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
					await Promise.all([
						useAccessStore.getState().loadAccess(),
						get().loadKeyTrustIssues(vaultId),
					])
				} catch (e) {
					set((state) => {
						state.error = String(e)
					})
				}
			},

			restartSync: async () => {
				const start = lastSyncStart
				if (!start) return
				await get().stopSync()
				await get().startSync(
					start.vaultId,
					start.vaultPath,
					start.serverUrl,
					start.requiresEntitlement,
				)
			},

			stopSync: async () => {
				lastSyncStart = null
				clearVaultKeyRetry()
				useAccessStore.getState().setAccess(null)
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
						state.keyTrustIssues = []
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

			createVaultKey: async (vaultId) => {
				await getPlatform().sync.createVaultKey(vaultId)
			},

			requestVaultKey: async (vaultId) => {
				const result = await getPlatform().sync.requestVaultKey(vaultId)
				if (result === "granted" && get().vekRequired) {
					clearVaultKeyRetry()
					set((state) => {
						state.vekRequired = false
					})
					if (lastSyncStart?.vaultId === vaultId) await get().restartSync()
				}
				return result
			},

			unlockVaultKey: async (vaultId, password) => {
				const platform = getPlatform()
				await platform.sync.unlockVaultKey(vaultId, password)
				clearVaultKeyRetry()
				set((state) => {
					state.vekRequired = false
				})
			},

			loadKeyTrustIssues: async (vaultId) => {
				try {
					const issues = await getPlatform().sync.getKeyTrustIssues(vaultId)
					set((state) => {
						state.keyTrustIssues = issues
					})
				} catch {}
			},

			trustMemberKey: async (vaultId, userId, fingerprint) => {
				await getPlatform().sync.trustMemberKey(vaultId, userId, fingerprint)
				set((state) => {
					state.keyTrustIssues = state.keyTrustIssues.filter(
						(issue) => issue.vaultId !== vaultId || issue.userId !== userId,
					)
				})
			},

			subscribeEvents: async () => {
				const platform = getPlatform()
				let pendingFileEvents: SyncFileEvent[] = []
				let fileEventTimer: ReturnType<typeof setTimeout> | null = null
				const flushFileEvents = () => {
					fileEventTimer = null
					const events = pendingFileEvents
					pendingFileEvents = []
					if (events.length === 0) return
					set((state) => {
						let synced = false
						for (const event of events) {
							if (
								event.status === "synced" ||
								event.status === "merged" ||
								event.status === "deleted"
							) {
								delete state.syncingFiles[event.path]
								synced = true
								if (event.status !== "deleted") {
									state.noteMetadataRevisions[event.path] =
										(state.noteMetadataRevisions[event.path] ?? 0) + 1
								}
							} else if (event.status.startsWith("error:") || event.status === "conflict") {
								delete state.syncingFiles[event.path]
							} else {
								state.syncingFiles[event.path] = event.status
							}
						}
						if (synced) state.lastSyncedAt = Date.now()
					})
				}
				const queueFileEvent = (event: SyncFileEvent) => {
					pendingFileEvents.push(event)
					fileEventTimer ??= setTimeout(flushFileEvents, FILE_EVENT_BATCH_MS)
				}
				const scheduleVaultKeyRetry = () => {
					clearVaultKeyRetry()
					vaultKeyRetryTimer = setTimeout(() => {
						vaultKeyRetryTimer = null
						const vaultId = lastSyncStart?.vaultId
						if (!vaultId || !get().vekRequired) return
						void get()
							.requestVaultKey(vaultId)
							.then((result) => {
								if (result === "pending") scheduleVaultKeyRetry()
							})
							.catch(scheduleVaultKeyRetry)
					}, VAULT_KEY_RETRY_MS)
				}

				const unlisteners = [
					() => {
						if (fileEventTimer) clearTimeout(fileEventTimer)
						fileEventTimer = null
						pendingFileEvents = []
					},
					platform.sync.onStateChanged((event) => {
						set((state) => {
							state.engineState = event.state
							if (event.state === "live") {
								state.lastSyncedAt = Date.now()
								state.error = null
								state.vekRequired = false
							}
						})
					}),
					platform.sync.onFileEvent((event) => {
						queueFileEvent(event)

						if (
							event.path === VAULT_FILES.propertySchema &&
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
						scheduleVaultKeyRetry()
					}),
					platform.sync.onAccessChanged((access) => {
						useAccessStore.getState().setAccess(access)
					}),
					platform.sync.onKeyTrustIssue((issue) => {
						set((state) => {
							upsertKeyTrustIssue(state.keyTrustIssues, issue)
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
					platform.sync.onVaultAccessDenied((event) => {
						set((state) => {
							state.engineState = "denied"
							state.error = event.reason
						})
						const logPrefix =
							event.kind === "subscription" ? "Sync plan validation failed" : "Vault access denied"
						useSyncLogStore.getState().log("error", `${logPrefix}: ${event.reason}`)
						if (event.kind === "subscription") {
							useSubscriptionStore.setState({
								block: {
									code: event.code ?? "subscription_required",
									message: event.reason,
								},
							})
						}
					}),
				]

				set((state) => {
					state.unlisteners = unlisteners
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
