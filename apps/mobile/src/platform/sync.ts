import type { EffectiveAccess, Platform, SyncPreferences } from "@cortex/platform"
import { isPathOrDescendant } from "@cortex/platform/utils"
import type { AccountIdentity } from "@cortex/sync-api"
import {
	createVaultKey,
	decodeVek,
	ensureOwnVaultKey,
	loadVaultKey as loadVaultKeyWithDeps,
	requestVaultKey,
	type SyncCommand,
	SyncEngine,
	syncDbPath,
	syncRuntime,
	unlockVaultKey,
	type VaultRef,
	type WorkerMethods,
} from "@cortex/sync-engine"
import { AppState, type AppStateStatus } from "react-native"

import { getDeviceId } from "./device"
import { secrets } from "./keychain"
import { serverApi } from "./serverApi"
import { onLocalFileChange } from "./syncSignals"

type SyncEvents = Parameters<ConstructorParameters<typeof SyncEngine>[0]["emit"]>
type StartCommand = Extract<SyncCommand, { type: "start" }>
type Listener = (payload: never) => void

const listeners = new Map<string, Set<Listener>>()
let access: EffectiveAccess | null = null
let preferences: SyncPreferences | null = null
let activeStart: StartCommand | null = null
let suspended = false

function on<T>(event: SyncEvents[0], listener: (payload: T) => void): () => void {
	let set = listeners.get(event)
	if (!set) {
		set = new Set()
		listeners.set(event, set)
	}
	set.add(listener as Listener)
	return () => set.delete(listener as Listener)
}

function loadVaultKey(vaultId: string): Promise<string | null> {
	return loadVaultKeyWithDeps(vaultId, {
		secrets,
		currentIdentity: () => serverApi.currentIdentity(),
		client: () => serverApi.client(),
	})
}

const engine = new SyncEngine({
	deviceId: getDeviceId,
	emit: (name, payload) => {
		if (name === "sync-access-changed") access = payload as EffectiveAccess | null
		for (const listener of listeners.get(name) ?? [])
			(listener as (value: unknown) => void)(payload)
	},
	tokens: {
		getAccessToken: (serverUrl) => serverApi.session.getAccessToken(serverUrl),
		refreshAccessToken: (serverUrl) => serverApi.session.refreshAccessToken(serverUrl),
	},
	loadVek: async (vaultId) => {
		const encoded = await loadVaultKey(vaultId)
		return encoded ? decodeVek(encoded) : null
	},
})

function request<K extends keyof WorkerMethods & string>(
	method: K,
	args: WorkerMethods[K]["args"],
): Promise<WorkerMethods[K]["result"]> {
	return engine.handleRequest({ method, args } as Parameters<
		SyncEngine["handleRequest"]
	>[0]) as Promise<WorkerMethods[K]["result"]>
}

async function requireIdentity(): Promise<AccountIdentity> {
	const identity = await serverApi.currentIdentity()
	if (!identity) throw new Error("Set up your encryption keys on this device first.")
	return identity
}

async function vaultRef(vaultId: string, vaultPath: string): Promise<VaultRef> {
	const serverUrl = await serverApi.selectServerUrl()
	if (!serverUrl) throw new Error("No sync server configured")
	return { vaultId, vaultPath, serverUrl }
}

function hasSyncDb(vaultPath: string): boolean {
	return syncRuntime().fs.existsSync(syncDbPath(vaultPath))
}

onLocalFileChange((path, deleted) => {
	if (!activeStart || suspended || !isPathOrDescendant(path, activeStart.vaultPath)) return
	engine.dispatch(deleted ? { type: "localFileDeleted", path } : { type: "localFileChanged", path })
})

AppState.addEventListener("change", (state: AppStateStatus) => {
	if (!activeStart) return
	if (state === "background" && !suspended) {
		suspended = true
		engine.dispatch({ type: "stop" })
	} else if (state === "active" && suspended) {
		suspended = false
		engine.dispatch(activeStart)
	}
})

export const syncApi = {
	checkVaultEncryption: serverApi.checkVaultEncryption,
	createVaultKey: async (vaultId) =>
		await createVaultKey(await serverApi.client(), secrets, vaultId, await requireIdentity()),
	requestVaultKey: async (vaultId) =>
		await requestVaultKey(await serverApi.client(), secrets, vaultId, await requireIdentity()),
	unlockVaultKey: async (vaultId, password) => {
		const api = await serverApi.client()
		await unlockVaultKey(api, secrets, vaultId, password)
		const identity = await serverApi.currentIdentity()
		if (identity) {
			await ensureOwnVaultKey(api, secrets, vaultId, identity).catch((error) =>
				console.warn("[sync] vault key self-registration failed:", error),
			)
		}
	},
	downloadVersion: async (vaultId, vaultPath, filePath, version) =>
		await request("downloadVersion", {
			vault: await vaultRef(vaultId, vaultPath),
			filePath,
			version,
		}),
	forceSyncFile: async (path) => engine.dispatch({ type: "forceSyncFile", path }),
	getAccess: async () => access,
	getKeyTrustIssues: async (vaultId) =>
		activeStart ? await request("getKeyTrustIssues", { vaultId }) : [],
	getConflicts: async (_vaultId, vaultPath) =>
		hasSyncDb(vaultPath) ? await request("getConflicts", { vaultPath }) : [],
	getNoteMetadata: async (vaultPath, filePath) =>
		hasSyncDb(vaultPath) ? await request("getNoteMetadata", { vaultPath, filePath }) : null,
	getVersionHistory: async (vaultId, vaultPath, filePath) =>
		await request("getVersionHistory", { vault: await vaultRef(vaultId, vaultPath), filePath }),
	listDeletedFiles: async (vaultId, vaultPath) =>
		await request("listDeletedFiles", { vault: await vaultRef(vaultId, vaultPath) }),
	onAccessChanged: (listener) => on("sync-access-changed", listener),
	onConflict: (listener) => on("sync-conflict", listener),
	onFileEvent: (listener) => on("sync-file-event", listener),
	onInitialSyncComplete: (listener) => on("sync-initial-complete", listener),
	onInitialSyncProgress: (listener) => on("sync-initial-progress", listener),
	onKeyTrustIssue: (listener) => on("sync-key-trust-issue", listener),
	onStateChanged: (listener) => on("sync-state-changed", listener),
	onSyncLog: (listener) => on("sync-log", listener),
	onVaultAccessDenied: (listener) => on("sync-vault-access-denied", listener),
	onVekRequired: (listener) => on("sync-vek-required", listener),
	resolveConflict: async (path, resolution) =>
		engine.dispatch({ type: "resolveConflict", path, resolution }),
	restoreDeletedFile: async (vaultId, vaultPath, filePath) => {
		await request("restoreDeletedFile", { vault: await vaultRef(vaultId, vaultPath), filePath })
	},
	restoreVersion: async (vaultId, vaultPath, filePath, version) => {
		await request("restoreVersion", {
			vault: await vaultRef(vaultId, vaultPath),
			filePath,
			version,
		})
	},
	start: async (vaultId, vaultPath, serverUrl, requiresEntitlement) => {
		await serverApi.selectServerUrl(serverUrl)
		const userId = (await serverApi.currentUserId(serverUrl)) ?? null
		activeStart = { type: "start", vaultId, vaultPath, serverUrl, requiresEntitlement, userId }
		suspended = false
		if (preferences) engine.dispatch({ type: "updateSyncPreferences", preferences })
		engine.dispatch(activeStart)
	},
	stop: async () => {
		activeStart = null
		access = null
		suspended = false
		engine.dispatch({ type: "stop" })
	},
	trustMemberKey: async (vaultId, userId, fingerprint) => {
		if (!activeStart) throw new Error("Start sync for this vault before verifying member keys.")
		await request("trustMemberKey", { vaultId, userId, fingerprint })
	},
	updateSyncPreferences: async (next) => {
		preferences = { ...next, excludedPaths: [...next.excludedPaths] }
		engine.dispatch({ type: "updateSyncPreferences", preferences })
	},
} satisfies Platform["sync"]
