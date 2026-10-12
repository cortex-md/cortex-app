export type CollabFrameOp = 1 | 2 | 3 | 4

export type CollabAvailability =
	| "ready"
	| "unsupported"
	| "signed-out"
	| "feature-disabled"
	| "locked"
	| "sync-off"

export type CollabFileSyncRole = "leader" | "follower"

export type CollabCloseReason =
	| "normal"
	| "access-changed"
	| "subscription"
	| "too-slow"
	| "room-full"
	| "buffer-full"
	| "too-large"
	| "unauthorized"
	| "forbidden"
	| "network"
	| "server-shutdown"

export interface CollabPeer {
	clientId: string
	userId: string
	displayName: string
	avatarUrl: string | null
	canWrite: boolean
}

export interface CollabWelcome {
	clientId: string
	upTo: number
	self: CollabPeer
	peers: CollabPeer[]
}

export type CollabChannelEvent =
	| { type: "welcome"; welcome: CollabWelcome }
	| { type: "synced" }
	| { type: "frame"; op: CollabFrameOp; sender: string; payload: Uint8Array }
	| { type: "peer-joined"; peer: CollabPeer }
	| { type: "peer-left"; clientId: string }
	| { type: "closed"; code: number; reason: CollabCloseReason }

export interface CollabChannel {
	send(op: CollabFrameOp, payload: Uint8Array): void
	compact(state: Uint8Array, upTo: number): void
	close(): void
}

export interface Collab {
	availability(vaultId: string): Promise<CollabAvailability>
	open(
		vaultId: string,
		roomPath: string,
		onEvent: (event: CollabChannelEvent) => void,
	): Promise<CollabChannel>
	setFileSyncRole(vaultId: string, roomPath: string, role: CollabFileSyncRole | null): Promise<void>
}
