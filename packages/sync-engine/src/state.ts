export type SyncEngineState =
	| "idle"
	| "authenticating"
	| "connecting"
	| "syncing"
	| "live"
	| "offline"
	| "recovering"
	| "denied"

export type ConnectionMode = "sse" | "polling" | "disconnected"

export type ConflictResolution = "keep_local" | "keep_remote" | { merged: { content: string } }

export type SyncErrorKind = "transient" | "permanent" | "auth"

export class SyncError extends Error {
	readonly kind: SyncErrorKind

	constructor(kind: SyncErrorKind, message: string) {
		super(message)
		this.kind = kind
		this.name = "SyncError"
	}

	static transient(message: string): SyncError {
		return new SyncError("transient", message)
	}

	static permanent(message: string): SyncError {
		return new SyncError("permanent", message)
	}

	static auth(message: string): SyncError {
		return new SyncError("auth", message)
	}

	static fromStatus(status: number, body: string): SyncError {
		const message = `HTTP ${status}: ${body}`
		if (status === 401 || status === 402 || status === 403) return SyncError.auth(message)
		if (status === 404 || status === 409 || status === 422) return SyncError.permanent(message)
		if (status === 429 || status >= 500) return SyncError.transient(message)
		if (status >= 400 && status < 500) return SyncError.permanent(message)
		return SyncError.transient(message)
	}

	get isRetriable(): boolean {
		return this.kind === "transient"
	}
}

export function isRetriableSyncErrorMessage(message: string): boolean {
	const status = httpStatusFromMessage(message)
	if (status === null) return true
	return SyncError.fromStatus(status, "").isRetriable
}

function httpStatusFromMessage(message: string): number | null {
	let remaining = message
	while (true) {
		const index = remaining.indexOf("HTTP")
		if (index < 0) return null
		const afterLabel = remaining.slice(index + 4)
		const trimmed = afterLabel.replace(/^\s+/, "")
		if (trimmed.length === afterLabel.length) {
			remaining = afterLabel
			continue
		}
		const digits = trimmed.match(/^\d{3}/)
		if (digits) return Number(digits[0])
		remaining = afterLabel
	}
}

export type SyncCommand =
	| {
			type: "start"
			vaultId: string
			vaultPath: string
			serverUrl: string
			requiresEntitlement: boolean
	  }
	| { type: "stop" }
	| { type: "localFileChanged"; path: string }
	| { type: "localFileDeleted"; path: string }
	| { type: "forceSyncFile"; path: string }
	| {
			type: "remoteFileChanged"
			path: string
			version: number
			actorId: string
			deviceId: string
			editedAt?: string | null
			created: boolean
			eventId?: string | null
	  }
	| { type: "remoteFileDeleted"; path: string; eventId?: string | null }
	| {
			type: "remoteFileRenamed"
			oldPath: string
			newPath: string
			eventId?: string | null
	  }
	| { type: "remoteEventProcessed"; eventId: string }
	| { type: "resolveConflict"; path: string; resolution: ConflictResolution }
	| { type: "sseConnected" }
	| { type: "sseDisconnected"; lastEventId?: string | null }
	| {
			type: "accessDenied"
			reason: string
			kind: string
			code?: string | null
	  }
	| { type: "reconcile" }
	| { type: "pollTick" }
	| {
			type: "updateSyncPreferences"
			syncSettings: boolean
			syncHotkeys: boolean
			syncWorkspace: boolean
			syncPluginMetadata: boolean
			syncThemeMetadata: boolean
			syncBookmarks: boolean
			ignoreImages: boolean
			excludedPaths: string[]
	  }
