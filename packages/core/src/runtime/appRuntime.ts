import { type FileEntry, getPlatform, type SyncConfig, type VaultMetadata } from "@cortex/platform"
import {
	getContentFingerprint,
	isMarkdownPath,
	isPathOrDescendant,
	mapWithConcurrency,
} from "@cortex/platform/utils"
import { useSearchStore } from "@cortex/search"
import { startCollabRuntime } from "../collab/collabRuntime"
import { noteCache } from "../noteCache"
import { useAuthStore } from "../stores/authStore"
import { useEditorStore } from "../stores/editorStore"
import { useLinksStore } from "../stores/linksStore"
import { useRemoteVaultStore } from "../stores/remoteVaultStore"
import { useSubscriptionStore } from "../stores/subscriptionStore"
import { useSyncLogStore } from "../stores/syncLogStore"
import { useSyncStore } from "../stores/syncStore"
import { useTagsStore } from "../stores/tagsStore"
import { useTasksStore } from "../stores/tasksStore"
import { useUIStore } from "../stores/uiStore"
import { subscribeVaultFileChanges, useVaultStore } from "../stores/vaultStore"
import { inferFileTabKind, useWorkspaceStore, type WorkspaceState } from "../stores/workspaceStore"
import { requiresCloudEntitlement, resolveSyncServerUrl } from "../sync/serverConfig"
import { completeFirstRunOnboarding } from "./appStartup"
import { startCommentsRuntime } from "./commentsRuntime"
import { startDatabaseRuntime } from "./databaseRuntime"
import { startTasksRuntime } from "./tasksRuntime"

type CancelScheduledWork = () => void
type ScheduleIdleWork = (work: () => void) => CancelScheduledWork

export type VaultIndexingMode = "eager" | "lazy"

export interface AppRuntimeOptions {
	persistWorkspace?: boolean
	trackActiveFile?: boolean
	indexing?: VaultIndexingMode
	scheduleIdleWork?: ScheduleIdleWork
	onVaultOpened?: (vault: VaultMetadata) => void
	onWorkspaceRestored?: (vault: VaultMetadata) => void
	onWorkspacePersistError?: (error: unknown, vaultPath: string) => void
}

export interface SyncStartInput {
	authenticated: boolean
	authServerUrl: string | null
	syncConfig: SyncConfig
	vaultPath: string | null
	linkedVaultId: string | null
	subscriptionBlocked: boolean
}

const WORKSPACE_PERSIST_DELAY_MS = 500
const INCREMENTAL_INDEX_DELAY_MS = 50
const INCREMENTAL_INDEX_READ_CONCURRENCY = 4

function scheduleTimeoutWork(work: () => void): CancelScheduledWork {
	const timeoutId = setTimeout(work, 250)
	return () => clearTimeout(timeoutId)
}

export function canStartSync(input: SyncStartInput): boolean {
	const serverUrl = resolveSyncServerUrl(input.syncConfig)
	const cloudSubscriptionBlocked =
		requiresCloudEntitlement(input.syncConfig) && input.subscriptionBlocked
	return (
		input.authenticated &&
		input.authServerUrl === serverUrl &&
		input.syncConfig.enabled &&
		input.vaultPath !== null &&
		input.linkedVaultId !== null &&
		serverUrl !== "" &&
		!cloudSubscriptionBlocked
	)
}

function startWorkspacePersistence(
	vaultPath: string,
	onError: AppRuntimeOptions["onWorkspacePersistError"],
): () => void {
	let persistTimer: ReturnType<typeof setTimeout> | null = null
	const persist = () => {
		persistTimer = null
		useWorkspaceStore
			.getState()
			.persistWorkspace(vaultPath)
			.catch((error) => onError?.(error, vaultPath))
	}
	const schedulePersist = () => {
		if (persistTimer) clearTimeout(persistTimer)
		persistTimer = setTimeout(persist, WORKSPACE_PERSIST_DELAY_MS)
	}
	const unsubscribeWorkspace = useWorkspaceStore.subscribe((state, previousState) => {
		if (
			state.panes !== previousState.panes ||
			state.splitTree !== previousState.splitTree ||
			state.activePaneId !== previousState.activePaneId
		) {
			schedulePersist()
		}
	})
	const unsubscribeUI = useUIStore.subscribe((state, previousState) => {
		if (
			state.leftSidebarCollapsed !== previousState.leftSidebarCollapsed ||
			state.leftSidebarWidth !== previousState.leftSidebarWidth ||
			state.rightSidebarCollapsed !== previousState.rightSidebarCollapsed ||
			state.rightSidebarPanel !== previousState.rightSidebarPanel ||
			state.quickFinderPreview !== previousState.quickFinderPreview
		) {
			schedulePersist()
		}
	})
	schedulePersist()
	return () => {
		unsubscribeWorkspace()
		unsubscribeUI()
		if (!persistTimer) return
		clearTimeout(persistTimer)
		persist()
	}
}

function getActiveMarkdownFilePath(workspace: WorkspaceState): string | null {
	const pane = workspace.panes[workspace.activePaneId]
	const tab = pane?.tabs.find((candidate) => candidate.id === pane.activeTabId)
	if (tab?.tabType !== "file") return null
	return (tab.fileKind ?? inferFileTabKind(tab.filePath)) === "markdown" ? tab.filePath : null
}

function startActiveFileTracking(): () => void {
	const syncActiveFile = (workspace: WorkspaceState) => {
		const filePath = getActiveMarkdownFilePath(workspace)
		const editor = useEditorStore.getState()
		if (editor.activeFilePath !== filePath) editor.setActiveFile(filePath)
	}
	syncActiveFile(useWorkspaceStore.getState())
	return useWorkspaceStore.subscribe((workspace, previousWorkspace) => {
		if (
			workspace.panes !== previousWorkspace.panes ||
			workspace.activePaneId !== previousWorkspace.activePaneId
		) {
			syncActiveFile(workspace)
		}
	})
}

function startVaultSession(options: AppRuntimeOptions): () => void {
	let currentVault: VaultMetadata | null = useVaultStore.getState().vault
	let stopWorkspacePersistence: (() => void) | null = null
	let active = true

	const openVaultSession = (vault: VaultMetadata) => {
		void useTagsStore.getState().loadTagColors(vault.path)
		void useSearchStore.getState().loadRecentQueries(vault.path)
		completeFirstRunOnboarding()
		options.onVaultOpened?.(vault)
		if (options.persistWorkspace === false) return
		void useWorkspaceStore
			.getState()
			.loadWorkspace(vault.path)
			.finally(() => {
				if (!active || currentVault !== vault) return
				stopWorkspacePersistence = startWorkspacePersistence(
					vault.path,
					options.onWorkspacePersistError,
				)
				options.onWorkspaceRestored?.(vault)
			})
	}

	if (currentVault) openVaultSession(currentVault)
	const unsubscribe = useVaultStore.subscribe((state) => {
		if (state.vault === currentVault) return
		currentVault = state.vault
		stopWorkspacePersistence?.()
		stopWorkspacePersistence = null
		if (state.vault) {
			openVaultSession(state.vault)
			return
		}
		useWorkspaceStore.getState().reset()
		useSearchStore.getState().reset()
		useTagsStore.getState().reset()
		useLinksStore.getState().reset()
		useTasksStore.getState().reset()
	})

	return () => {
		active = false
		unsubscribe()
		stopWorkspacePersistence?.()
	}
}

function collectMarkdownPaths(files: readonly FileEntry[]): Set<string> {
	return new Set(
		files.flatMap((file) => (!file.isDir && isMarkdownPath(file.path) ? [file.path] : [])),
	)
}

function indexNoteContent(
	vaultPath: string,
	filePath: string,
	content: string,
	modifiedAt: number,
): void {
	void useSearchStore.getState().indexFile(vaultPath, filePath, { content, modifiedAt })
	const fingerprint = getContentFingerprint(content, modifiedAt)
	useTagsStore.getState().updateFileInIndex(filePath, content, fingerprint)
	useLinksStore.getState().updateFileInIndex(filePath, content, fingerprint)
	useTasksStore.getState().updateFileInIndex(filePath, content, fingerprint)
}

function removeIndexedPath(vaultPath: string, filePath: string): void {
	useSearchStore.getState().removeFile(vaultPath, filePath)
	useTagsStore.getState().removeFileFromIndex(filePath)
	useLinksStore.getState().removeFileFromIndex(filePath)
	useTasksStore.getState().removeFileFromIndex(filePath)
}

function startVaultIndexing(scheduleIdleWork: ScheduleIdleWork): () => void {
	let currentVault: VaultMetadata | null = null
	let ready = false
	let indexedPaths = new Set<string>()
	let cancelFullIndex: CancelScheduledWork | null = null
	let incrementalTimer: ReturnType<typeof setTimeout> | null = null
	const queuedIndexPaths = new Set<string>()
	const queuedRemovePaths = new Set<string>()

	const flushIncrementalQueue = async () => {
		incrementalTimer = null
		const vault = currentVault
		if (!vault) return
		const removedPaths = Array.from(queuedRemovePaths)
		const changedPaths = Array.from(queuedIndexPaths)
		queuedRemovePaths.clear()
		queuedIndexPaths.clear()
		for (const path of removedPaths) removeIndexedPath(vault.path, path)
		await mapWithConcurrency(changedPaths, INCREMENTAL_INDEX_READ_CONCURRENCY, async (path) => {
			try {
				const snapshot = await getPlatform().fs.readFileSnapshot(path)
				if (currentVault !== vault) return
				indexNoteContent(vault.path, path, snapshot.content, snapshot.metadata.modifiedAt)
			} catch {
				if (currentVault === vault) removeIndexedPath(vault.path, path)
			}
		})
	}

	const scheduleIncrementalFlush = () => {
		if (incrementalTimer) return
		incrementalTimer = setTimeout(() => void flushIncrementalQueue(), INCREMENTAL_INDEX_DELAY_MS)
	}

	const queueIndex = (path: string) => {
		queuedRemovePaths.delete(path)
		queuedIndexPaths.add(path)
		scheduleIncrementalFlush()
	}

	const queueRemoval = (path: string) => {
		queuedIndexPaths.delete(path)
		queuedRemovePaths.add(path)
		scheduleIncrementalFlush()
	}

	const syncIndexedPaths = (vault: VaultMetadata) => {
		const state = useVaultStore.getState()
		if (state.vault !== vault) return
		const nextPaths = collectMarkdownPaths(state.files)
		for (const path of nextPaths) if (!indexedPaths.has(path)) queueIndex(path)
		for (const path of indexedPaths) if (!nextPaths.has(path)) queueRemoval(path)
		indexedPaths = nextPaths
	}

	const stopVaultIndexing = () => {
		cancelFullIndex?.()
		cancelFullIndex = null
		if (incrementalTimer) clearTimeout(incrementalTimer)
		incrementalTimer = null
		queuedIndexPaths.clear()
		queuedRemovePaths.clear()
		ready = false
		indexedPaths = new Set()
		useSearchStore.getState().cancelIndexing()
		useTagsStore.getState().cancelIndexing()
		useLinksStore.getState().cancelIndexing()
		useTasksStore.getState().cancelIndexing()
	}

	const startFullIndex = (vault: VaultMetadata) => {
		cancelFullIndex = scheduleIdleWork(() => {
			cancelFullIndex = null
			void (async () => {
				const files = useVaultStore.getState().files
				await useSearchStore.getState().indexVault(vault.path, files)
				if (currentVault !== vault) return
				await useTagsStore.getState().buildIndexFromFiles(vault.path, files)
				if (currentVault !== vault) return
				await useLinksStore.getState().buildIndexFromFiles(vault.path, files)
				if (currentVault !== vault) return
				await useTasksStore.getState().buildIndexFromFiles(vault.path, files)
				if (currentVault !== vault) return
				indexedPaths = collectMarkdownPaths(files)
				ready = true
				syncIndexedPaths(vault)
			})()
		})
	}

	const handleVaultState = () => {
		const { vault } = useVaultStore.getState()
		if (vault !== currentVault) {
			stopVaultIndexing()
			currentVault = vault
			if (vault) startFullIndex(vault)
			return
		}
		if (vault && ready) syncIndexedPaths(vault)
	}

	handleVaultState()
	const unsubscribeVault = useVaultStore.subscribe((state, previousState) => {
		if (state.vault !== previousState.vault || state.files !== previousState.files) {
			handleVaultState()
		}
	})
	const unsubscribeFileChanges = subscribeVaultFileChanges((changes) => {
		if (!ready) return
		for (const change of changes) {
			if (change.kind === "deleted" || !indexedPaths.has(change.path)) continue
			if (!noteCache.getEntry(change.path)) queueIndex(change.path)
		}
	})
	const unsubscribeDiskContent = noteCache.onDiskContentChange((entry) => {
		const vault = currentVault
		if (!ready || !vault || !isPathOrDescendant(entry.filePath, vault.path)) return
		queuedIndexPaths.delete(entry.filePath)
		indexNoteContent(
			vault.path,
			entry.filePath,
			entry.content,
			entry.metadata?.modifiedAt ?? entry.mtime,
		)
	})

	return () => {
		unsubscribeVault()
		unsubscribeFileChanges()
		unsubscribeDiskContent()
		stopVaultIndexing()
		currentVault = null
	}
}

export function startSyncLifecycle(): () => void {
	let syncActive = false
	let linkedVaultPath: string | null = null
	let checkedSyncConfig: SyncConfig | null = null

	const evaluate = () => {
		const vault = useVaultStore.getState().vault
		const vaultPath = vault?.path ?? ""
		if (vaultPath !== linkedVaultPath) {
			linkedVaultPath = vaultPath
			void useRemoteVaultStore.getState().loadLink(vaultPath)
		}

		const { syncConfig, linkedVaultId } = useRemoteVaultStore.getState()
		const serverUrl = resolveSyncServerUrl(syncConfig)
		if (syncConfig !== checkedSyncConfig) {
			checkedSyncConfig = syncConfig
			if (serverUrl) void useAuthStore.getState().checkAuth(serverUrl)
		}

		const auth = useAuthStore.getState()
		const shouldSync = canStartSync({
			authenticated: auth.authenticated,
			authServerUrl: auth.serverUrl,
			syncConfig,
			vaultPath: vault?.path ?? null,
			linkedVaultId,
			subscriptionBlocked: useSubscriptionStore.getState().block !== null,
		})

		if (shouldSync && !syncActive && vault && linkedVaultId) {
			syncActive = true
			useSyncLogStore.getState().log("info", "Sync lifecycle: starting sync", {
				serverUrl,
				vaultId: linkedVaultId,
			})
			void useSyncStore
				.getState()
				.startSync(linkedVaultId, vault.path, serverUrl, requiresCloudEntitlement(syncConfig))
		} else if (!shouldSync && syncActive) {
			syncActive = false
			useSyncLogStore.getState().log("info", "Sync lifecycle: stopping sync")
			void useSyncStore.getState().stopSync()
		}
	}

	evaluate()
	const unsubscribes = [
		useVaultStore.subscribe((state, previousState) => {
			if (state.vault !== previousState.vault) evaluate()
		}),
		useAuthStore.subscribe(evaluate),
		useRemoteVaultStore.subscribe(evaluate),
		useSubscriptionStore.subscribe(evaluate),
	]

	return () => {
		for (const unsubscribe of unsubscribes) unsubscribe()
		if (!syncActive) return
		syncActive = false
		void useSyncStore.getState().stopSync()
	}
}

export function startAppRuntime(options: AppRuntimeOptions = {}): () => void {
	noteCache.start()
	const disposers = [
		startVaultSession(options),
		startCollabRuntime(),
		startDatabaseRuntime(),
		startCommentsRuntime(),
	]
	if (options.indexing !== "lazy") {
		disposers.push(startVaultIndexing(options.scheduleIdleWork ?? scheduleTimeoutWork))
		disposers.push(startTasksRuntime())
	}
	if (options.trackActiveFile !== false) disposers.push(startActiveFileTracking())
	return () => {
		for (const dispose of disposers.reverse()) dispose()
		noteCache.stop()
	}
}
