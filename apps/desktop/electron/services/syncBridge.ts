import { access } from "node:fs/promises"
import { join } from "node:path"
import type {
	CollabFileSyncRole,
	EffectiveAccess,
	Sync,
	SyncPreferences,
	WatchEvent,
} from "@cortex/platform"
import { getVaultFilePath, isPathOrDescendant, VAULT_FILES } from "@cortex/platform/utils"
import type { AccountIdentity } from "@cortex/sync-api"
import {
	createVaultKey,
	ensureOwnVaultKey,
	type FromWorkerMessage,
	loadVaultKey as loadVaultKeyWithDeps,
	type MainMethods,
	RpcChannel,
	type RpcRequest,
	requestVaultKey,
	respond,
	type SyncCommand,
	type ToWorkerMessage,
	unlockVaultKey,
	type VaultRef,
	type WorkerMethods,
} from "@cortex/sync-engine"
import { type UtilityProcess, utilityProcess, webContents } from "electron"
import { EVENT_CHANNEL_PREFIX } from "../contract"
import { getInvokeSender } from "../ipc/sender"
import { resolveMainWindowId } from "../windows"
import { getDeviceId } from "./device"
import { secrets, serverApi } from "./serverApi"

type SyncCommands = {
	[K in keyof Sync as K extends `on${string}` ? never : K]: Sync[K]
}

interface WorkerHandle {
	process: UtilityProcess
	rpc: RpcChannel<WorkerMethods>
}

interface SyncSession {
	ownerId: number
	worker: WorkerHandle | null
	vaultPath: string | null
	preferences: SyncPreferences | null
	access: EffectiveAccess | null
	collabRoles: Map<string, CollabFileSyncRole>
}

const sessions = new Map<number, SyncSession>()

function sendToOwner(ownerId: number, event: string, payload: unknown): void {
	const contents = webContents.fromId(ownerId)
	if (contents && !contents.isDestroyed()) contents.send(`${EVENT_CHANNEL_PREFIX}${event}`, payload)
}

function sessionFor(ownerId: number): SyncSession {
	let session = sessions.get(ownerId)
	if (!session) {
		session = {
			ownerId,
			worker: null,
			vaultPath: null,
			preferences: null,
			access: null,
			collabRoles: new Map(),
		}
		sessions.set(ownerId, session)
	}
	return session
}

function currentSession(): SyncSession {
	const sender = getInvokeSender()
	const ownerId = sender ? resolveMainWindowId(sender.id) : null
	if (ownerId === null) throw new Error("Sync requests must come from an app window")
	return sessionFor(ownerId)
}

async function requireIdentity(): Promise<AccountIdentity> {
	const identity = await serverApi.currentIdentity()
	if (!identity) throw new Error("Set up your encryption keys on this device first.")
	return identity
}

async function loadVaultKey(vaultId: string): Promise<string | null> {
	return await loadVaultKeyWithDeps(vaultId, {
		secrets,
		currentIdentity: () => serverApi.currentIdentity(),
		client: () => serverApi.client(),
	})
}

async function handleMainRequest(request: RpcRequest<MainMethods>): Promise<unknown> {
	switch (request.method) {
		case "getAccessToken":
			return await serverApi.session.getAccessToken(request.args.serverUrl)
		case "refreshAccessToken":
			return await serverApi.session.refreshAccessToken(request.args.serverUrl)
		case "getVek":
			return await loadVaultKey(request.args.vaultId)
	}
}

function post(handle: WorkerHandle, message: ToWorkerMessage): void {
	handle.process.postMessage(message)
}

function spawnWorker(session: SyncSession): WorkerHandle {
	const child = utilityProcess.fork(join(__dirname, "sync-worker.js"), [], {
		serviceName: "cortex-sync-engine",
		stdio: "inherit",
	})
	const handle: WorkerHandle = {
		process: child,
		rpc: new RpcChannel<WorkerMethods>((message) => child.postMessage(message)),
	}
	child.on("message", (message: FromWorkerMessage) => {
		switch (message.type) {
			case "event":
				if (message.name === "sync-access-changed") session.access = message.payload
				sendToOwner(session.ownerId, message.name, message.payload)
				return
			case "request":
				respond(message, handleMainRequest, (response) => child.postMessage(response)).catch(
					(error: unknown) => console.warn("[sync] failed to answer worker request:", error),
				)
				return
			case "response":
				handle.rpc.settle(message)
				return
		}
	})
	child.on("exit", (code) => {
		handle.rpc.rejectAll(new Error("Sync worker exited"))
		if (session.worker !== handle) return
		session.worker = null
		session.access = null
		if (session.vaultPath) {
			session.vaultPath = null
			sendToOwner(session.ownerId, "sync-log", {
				level: "error",
				message: `Sync worker exited (${code})`,
			})
			sendToOwner(session.ownerId, "sync-state-changed", { state: "idle" })
		}
	})
	post(handle, { type: "init", deviceId: getDeviceId() })
	if (session.preferences) {
		post(handle, { type: "command", command: updatePreferencesCommand(session.preferences) })
	}
	for (const [path, role] of session.collabRoles) {
		post(handle, { type: "command", command: { type: "setCollabRole", path, role } })
	}
	return handle
}

function ensureWorker(session: SyncSession): WorkerHandle {
	session.worker ??= spawnWorker(session)
	return session.worker
}

function command(session: SyncSession, message: SyncCommand): void {
	if (session.worker) post(session.worker, { type: "command", command: message })
}

function updatePreferencesCommand(next: SyncPreferences): SyncCommand {
	return { type: "updateSyncPreferences", preferences: next }
}

async function vaultRef(vaultId: string, vaultPath: string): Promise<VaultRef> {
	const serverUrl = await serverApi.selectServerUrl()
	if (!serverUrl) throw new Error("No sync server configured")
	return { vaultId, vaultPath, serverUrl }
}

async function hasSyncDb(vaultPath: string): Promise<boolean> {
	try {
		await access(getVaultFilePath(vaultPath, VAULT_FILES.syncDb))
		return true
	} catch {
		return false
	}
}

export function notifyLocalFileChange(absolutePath: string, kind: WatchEvent["kind"]): void {
	for (const session of sessions.values()) {
		if (!session.worker || !session.vaultPath) continue
		if (!isPathOrDescendant(absolutePath, session.vaultPath)) continue
		command(
			session,
			kind === "deleted"
				? { type: "localFileDeleted", path: absolutePath }
				: { type: "localFileChanged", path: absolutePath },
		)
	}
}

export function setCollabRole(
	ownerId: number,
	path: string,
	role: CollabFileSyncRole | null,
): void {
	const session = sessionFor(ownerId)
	if (role) session.collabRoles.set(path, role)
	else if (!session.collabRoles.delete(path)) return
	command(session, { type: "setCollabRole", path, role })
}

export function clearCollabRoles(ownerId: number): void {
	const session = sessions.get(ownerId)
	if (!session) return
	for (const path of session.collabRoles.keys()) {
		command(session, { type: "setCollabRole", path, role: null })
	}
	session.collabRoles.clear()
}

export function disposeSyncSession(ownerId: number): void {
	const session = sessions.get(ownerId)
	if (!session) return
	sessions.delete(ownerId)
	session.worker?.process.kill()
}

export function stopSyncWorkers(): void {
	for (const ownerId of [...sessions.keys()]) disposeSyncSession(ownerId)
}

export const syncService = {
	updateSyncPreferences: async (next) => {
		const session = currentSession()
		session.preferences = { ...next, excludedPaths: [...next.excludedPaths] }
		command(session, updatePreferencesCommand(session.preferences))
	},
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
	getAccess: async () => currentSession().access,
	getKeyTrustIssues: async (vaultId) => {
		const worker = currentSession().worker
		return worker ? await worker.rpc.call("getKeyTrustIssues", { vaultId }) : []
	},
	trustMemberKey: async (vaultId, userId, fingerprint) => {
		const worker = currentSession().worker
		if (!worker) throw new Error("Start sync for this vault before verifying member keys.")
		await worker.rpc.call("trustMemberKey", { vaultId, userId, fingerprint })
	},
	start: async (vaultId, vaultPath, serverUrl, requiresEntitlement) => {
		const session = currentSession()
		await serverApi.selectServerUrl(serverUrl)
		const userId = (await serverApi.currentUserId(serverUrl)) ?? null
		session.vaultPath = vaultPath
		post(ensureWorker(session), {
			type: "command",
			command: { type: "start", vaultId, vaultPath, serverUrl, requiresEntitlement, userId },
		})
	},
	stop: async () => {
		const session = currentSession()
		session.vaultPath = null
		session.access = null
		session.collabRoles.clear()
		command(session, { type: "stop" })
	},
	forceSyncFile: async (path) => command(currentSession(), { type: "forceSyncFile", path }),
	resolveConflict: async (path, resolution) =>
		command(currentSession(), { type: "resolveConflict", path, resolution }),
	getConflicts: async (_vaultId, vaultPath) =>
		(await hasSyncDb(vaultPath))
			? await ensureWorker(currentSession()).rpc.call("getConflicts", { vaultPath })
			: [],
	getNoteMetadata: async (vaultPath, filePath) =>
		(await hasSyncDb(vaultPath))
			? await ensureWorker(currentSession()).rpc.call("getNoteMetadata", { vaultPath, filePath })
			: null,
	getVersionHistory: async (vaultId, vaultPath, filePath) =>
		await ensureWorker(currentSession()).rpc.call("getVersionHistory", {
			vault: await vaultRef(vaultId, vaultPath),
			filePath,
		}),
	downloadVersion: async (vaultId, vaultPath, filePath, version) =>
		await ensureWorker(currentSession()).rpc.call("downloadVersion", {
			vault: await vaultRef(vaultId, vaultPath),
			filePath,
			version,
		}),
	restoreVersion: async (vaultId, vaultPath, filePath, version) => {
		await ensureWorker(currentSession()).rpc.call("restoreVersion", {
			vault: await vaultRef(vaultId, vaultPath),
			filePath,
			version,
		})
	},
	listDeletedFiles: async (vaultId, vaultPath) =>
		await ensureWorker(currentSession()).rpc.call("listDeletedFiles", {
			vault: await vaultRef(vaultId, vaultPath),
		}),
	restoreDeletedFile: async (vaultId, vaultPath, filePath) => {
		await ensureWorker(currentSession()).rpc.call("restoreDeletedFile", {
			vault: await vaultRef(vaultId, vaultPath),
			filePath,
		})
	},
} satisfies SyncCommands
