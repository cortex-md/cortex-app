import type {
	CollabFileSyncRole,
	ConflictInfo,
	ConflictResolution,
	DeletedFileInfo,
	EffectiveAccess,
	InitialSyncProgressEvent,
	KeyTrustIssue,
	NoteSyncMetadata,
	SyncAccessDeniedEvent,
	SyncConflictEvent,
	SyncFileEvent,
	SyncPreferences,
	SyncStateEvent,
	VersionInfo,
} from "@cortex/platform"

export type SyncCommand =
	| {
			type: "start"
			vaultId: string
			vaultPath: string
			serverUrl: string
			requiresEntitlement: boolean
			userId?: string | null
	  }
	| { type: "stop" }
	| { type: "localFileChanged"; path: string }
	| { type: "localFileDeleted"; path: string }
	| { type: "forceSyncFile"; path: string }
	| { type: "resolveConflict"; path: string; resolution: ConflictResolution }
	| { type: "updateSyncPreferences"; preferences: SyncPreferences }
	| { type: "setCollabRole"; path: string; role: CollabFileSyncRole | null }

export interface VaultRef {
	vaultId: string
	vaultPath: string
	serverUrl: string
}

export type WorkerMethods = {
	getConflicts: { args: { vaultPath: string }; result: ConflictInfo[] }
	getNoteMetadata: {
		args: { vaultPath: string; filePath: string }
		result: NoteSyncMetadata | null
	}
	getVersionHistory: { args: { vault: VaultRef; filePath: string }; result: VersionInfo[] }
	downloadVersion: { args: { vault: VaultRef; filePath: string; version: string }; result: string }
	restoreVersion: { args: { vault: VaultRef; filePath: string; version: string }; result: null }
	listDeletedFiles: { args: { vault: VaultRef }; result: DeletedFileInfo[] }
	restoreDeletedFile: { args: { vault: VaultRef; filePath: string }; result: null }
	getKeyTrustIssues: { args: { vaultId: string }; result: KeyTrustIssue[] }
	trustMemberKey: { args: { vaultId: string; userId: string; fingerprint: string }; result: null }
	shutdown: { args: Record<string, never>; result: null }
}

export type MainMethods = {
	getAccessToken: { args: { serverUrl: string }; result: string | null }
	refreshAccessToken: { args: { serverUrl: string }; result: string | null }
	getVek: { args: { vaultId: string }; result: string | null }
}

type MethodMap = Record<string, { args: unknown; result: unknown }>

export type RpcRequest<M extends MethodMap> = {
	[K in keyof M & string]: { method: K; args: M[K]["args"] }
}[keyof M & string]

export interface SyncEvents {
	"sync-state-changed": SyncStateEvent
	"sync-file-event": SyncFileEvent
	"sync-initial-progress": InitialSyncProgressEvent
	"sync-conflict": SyncConflictEvent
	"sync-initial-complete": undefined
	"sync-vek-required": undefined
	"sync-vault-access-denied": SyncAccessDeniedEvent
	"sync-access-changed": EffectiveAccess | null
	"sync-key-trust-issue": KeyTrustIssue
	"sync-log": { level: string; message: string }
}

export type SyncEventMessage = {
	[K in keyof SyncEvents]: { type: "event"; name: K; payload: SyncEvents[K] }
}[keyof SyncEvents]

export type EmitSyncEvent = <K extends keyof SyncEvents>(name: K, payload: SyncEvents[K]) => void

interface RpcRequestMessage<M extends MethodMap> {
	type: "request"
	id: number
	request: RpcRequest<M>
}

export interface RpcResponseMessage {
	type: "response"
	id: number
	result?: unknown
	error?: string
}

export type ToWorkerMessage =
	| { type: "init"; deviceId: string }
	| { type: "command"; command: SyncCommand }
	| RpcRequestMessage<WorkerMethods>
	| RpcResponseMessage

export type FromWorkerMessage =
	| SyncEventMessage
	| RpcRequestMessage<MainMethods>
	| RpcResponseMessage

export class RpcChannel<M extends MethodMap> {
	private nextId = 1
	private readonly pending = new Map<
		number,
		{ resolve: (value: unknown) => void; reject: (error: Error) => void }
	>()

	constructor(private readonly post: (message: RpcRequestMessage<M>) => void) {}

	call<K extends keyof M & string>(method: K, args: M[K]["args"]): Promise<M[K]["result"]> {
		const id = this.nextId++
		return new Promise((resolve, reject) => {
			this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
			try {
				this.post({ type: "request", id, request: { method, args } as RpcRequest<M> })
			} catch (error) {
				this.pending.delete(id)
				reject(error instanceof Error ? error : new Error(String(error)))
			}
		})
	}

	settle(message: RpcResponseMessage): void {
		const waiter = this.pending.get(message.id)
		if (!waiter) return
		this.pending.delete(message.id)
		if (message.error !== undefined) waiter.reject(new Error(message.error))
		else waiter.resolve(message.result ?? null)
	}

	rejectAll(error: Error): void {
		for (const waiter of this.pending.values()) waiter.reject(error)
		this.pending.clear()
	}
}

export async function respond<M extends MethodMap>(
	request: RpcRequestMessage<M>,
	handle: (request: RpcRequest<M>) => Promise<unknown>,
	post: (message: RpcResponseMessage) => void,
): Promise<void> {
	try {
		post({ type: "response", id: request.id, result: (await handle(request.request)) ?? null })
	} catch (error) {
		post({
			type: "response",
			id: request.id,
			error: error instanceof Error ? error.message : String(error),
		})
	}
}
