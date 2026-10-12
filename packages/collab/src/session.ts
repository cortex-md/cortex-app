import type {
	Collab,
	CollabChannel,
	CollabChannelEvent,
	CollabCloseReason,
	CollabFileSyncRole,
	CollabFrameOp,
	CollabPeer,
	CollabWelcome,
} from "@cortex/platform"
import {
	applyAwarenessUpdate,
	encodeAwarenessUpdate,
	removeAwarenessStates,
} from "y-protocols/awareness"
import * as Y from "yjs"
import { collabUserColor } from "./colors"
import {
	AWARENESS_THROTTLE_MS,
	COMPACT_MAX_BYTES,
	EMPTY_UPDATE_BYTES,
	LEADER_HANDSHAKE_MS,
	OUTGOING_FLUSH_BYTES,
	OUTGOING_FLUSH_DELAY_MS,
	RECONCILE_ORIGIN,
	RECONNECT_MAX_DELAY_MS,
	RECONNECT_MIN_DELAY_MS,
	REMOTE_ORIGIN,
} from "./constants"
import { type CollabNoteDocument, type CollabNoteParts, sameNoteParts } from "./document"
import { type CollabAwarenessState, electFileSyncLeader } from "./leader"
import { COLLAB_OPS } from "./wire/frames"

export type CollabSessionStatus = "connecting" | "live" | "offline" | "unavailable" | "closed"

export interface CollabSessionSnapshot {
	status: CollabSessionStatus
	reason: CollabCloseReason | null
	role: CollabFileSyncRole | null
	canWrite: boolean
	ready: boolean
	peers: readonly CollabPeer[]
	present: readonly CollabPeer[]
}

export interface CollabSessionUser {
	id: string
	name: string
	avatarUrl: string | null
}

export interface CollabSessionOptions {
	collab: Collab
	vaultId: string
	roomPath: string
	noteDocument: CollabNoteDocument
	user: CollabSessionUser
	fileSync?: boolean
	readLocalParts: () => CollabNoteParts | null
	hasUnsyncedLocalChanges: () => boolean
	takeSnapshot: () => void
	random?: () => number
}

export interface CollabSessionDisposeOptions {
	compact?: boolean
}

interface AwarenessChanges {
	added: number[]
	updated: number[]
	removed: number[]
}

type SnapshotPatch = Partial<CollabSessionSnapshot>

const RECONNECT_REASONS: ReadonlySet<CollabCloseReason> = new Set([
	"normal",
	"network",
	"too-slow",
	"buffer-full",
	"server-shutdown",
	"access-changed",
])

const NO_PEERS: readonly CollabPeer[] = []

const INITIAL_SNAPSHOT: CollabSessionSnapshot = {
	status: "connecting",
	reason: null,
	role: null,
	canWrite: false,
	ready: false,
	peers: NO_PEERS,
	present: NO_PEERS,
}

function isSyncUpdateOp(op: CollabFrameOp): boolean {
	return op === COLLAB_OPS.syncStep2 || op === COLLAB_OPS.update
}

export class CollabSession {
	private snapshot = INITIAL_SNAPSHOT
	private readonly listeners = new Set<() => void>()
	private channel: CollabChannel | null = null
	private connection = 0
	private queuedEvents: CollabChannelEvent[] = []
	private sessionClientId: string | null = null
	private upTo = 0
	private serverState: Y.Doc | null = null
	private synced = false
	private active = true
	private pendingUpdates: Uint8Array[] = []
	private pendingBytes = 0
	private flushTimer: ReturnType<typeof setTimeout> | null = null
	private awarenessTimer: ReturnType<typeof setTimeout> | null = null
	private handshakeTimer: ReturnType<typeof setTimeout> | null = null
	private handshakeUntil = 0
	private awarenessDirty = false
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null
	private reconnectAttempts = 0
	private disposed = false

	constructor(private readonly options: CollabSessionOptions) {}

	get noteDocument(): CollabNoteDocument {
		return this.options.noteDocument
	}

	get roomPath(): string {
		return this.options.roomPath
	}

	start(): void {
		const { doc, awareness } = this.options.noteDocument
		doc.on("update", this.handleDocumentUpdate)
		awareness.on("update", this.handleAwarenessUpdate)
		awareness.on("change", this.handleAwarenessChange)
		void this.connect()
	}

	getSnapshot = (): CollabSessionSnapshot => this.snapshot

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	setActive(active: boolean): void {
		if (this.active === active || this.disposed) return
		this.active = active
		if (!this.synced) return
		if (active) this.publishAwarenessState()
		else this.options.noteDocument.awareness.setLocalState(null)
		this.updateRole()
	}

	dispose({ compact = true }: CollabSessionDisposeOptions = {}): void {
		if (this.disposed) return
		this.disposed = true
		this.clearReconnectTimer()
		this.flushUpdates()
		const { doc, awareness } = this.options.noteDocument
		doc.off("update", this.handleDocumentUpdate)
		awareness.off("update", this.handleAwarenessUpdate)
		awareness.off("change", this.handleAwarenessChange)
		if (this.awarenessTimer) clearTimeout(this.awarenessTimer)
		this.awarenessTimer = null
		this.clearHandshake()
		const channel = this.channel
		if (channel && this.synced) {
			if (compact && this.isLastWriter()) {
				const state = Y.encodeStateAsUpdate(doc)
				if (state.length <= COMPACT_MAX_BYTES) channel.compact(state, this.upTo)
			}
			awareness.setLocalState(null)
			channel.send(COLLAB_OPS.awareness, encodeAwarenessUpdate(awareness, [doc.clientID]))
		} else {
			awareness.setLocalState(null)
		}
		this.resetConnection()
		channel?.close()
		this.setRole(null)
		this.publish({ status: "closed", peers: NO_PEERS })
		this.listeners.clear()
	}

	private async connect(): Promise<void> {
		if (this.disposed) return
		const connection = ++this.connection
		this.queuedEvents = []
		this.serverState?.destroy()
		this.serverState = new Y.Doc()
		this.publish({ status: "connecting", reason: null })
		this.setRole("follower")
		const { collab, vaultId, roomPath } = this.options
		try {
			const channel = await collab.open(vaultId, roomPath, (event) => {
				if (connection !== this.connection) return
				if (this.channel) this.handleEvent(event)
				else this.queuedEvents.push(event)
			})
			if (connection !== this.connection || this.disposed) {
				channel.close()
				return
			}
			this.channel = channel
			const queued = this.queuedEvents
			this.queuedEvents = []
			for (const event of queued) {
				if (connection !== this.connection) return
				this.handleEvent(event)
			}
		} catch {
			if (connection === this.connection && !this.disposed) this.handleClosed("network")
		}
	}

	private handleEvent(event: CollabChannelEvent): void {
		switch (event.type) {
			case "welcome":
				this.handleWelcome(event.welcome)
				return
			case "synced":
				this.handleSynced()
				return
			case "frame":
				this.handleFrame(event.op, event.sender, event.payload)
				return
			case "peer-joined":
				this.publish({
					peers: [
						...this.snapshot.peers.filter((peer) => peer.clientId !== event.peer.clientId),
						event.peer,
					],
				})
				this.awarenessDirty = true
				this.scheduleAwareness()
				this.startHandshake()
				return
			case "peer-left":
				this.removePeerAwareness(event.clientId)
				this.publish({
					peers: this.snapshot.peers.filter((peer) => peer.clientId !== event.clientId),
				})
				return
			case "closed":
				this.handleClosed(event.reason)
				return
		}
	}

	private handleWelcome(welcome: CollabWelcome): void {
		this.sessionClientId = welcome.clientId
		this.upTo = welcome.upTo
		this.publish({
			canWrite: welcome.self.canWrite,
			peers: welcome.peers.filter((peer) => peer.clientId !== welcome.clientId),
		})
	}

	private handleFrame(op: CollabFrameOp, sender: string, payload: Uint8Array): void {
		const { doc, awareness } = this.options.noteDocument
		try {
			if (isSyncUpdateOp(op)) {
				if (!this.synced && this.serverState) Y.applyUpdate(this.serverState, payload)
				Y.applyUpdate(doc, payload, REMOTE_ORIGIN)
			} else if (op === COLLAB_OPS.awareness) {
				applyAwarenessUpdate(awareness, payload, REMOTE_ORIGIN)
			} else if (op === COLLAB_OPS.syncStep1) {
				this.answerStateVector(sender, payload)
			}
		} catch {}
	}

	private handleSynced(): void {
		const { noteDocument } = this.options
		this.reconcile()
		this.synced = true
		const serverVector = this.serverState ? Y.encodeStateVector(this.serverState) : undefined
		this.serverState?.destroy()
		this.serverState = null
		if (this.snapshot.canWrite) {
			const missing = Y.encodeStateAsUpdate(noteDocument.doc, serverVector)
			if (missing.length > EMPTY_UPDATE_BYTES) this.send(COLLAB_OPS.update, missing)
		}
		this.send(COLLAB_OPS.syncStep1, Y.encodeStateVector(noteDocument.doc))
		this.reconnectAttempts = 0
		if (this.active) this.publishAwarenessState()
		this.publish({ status: "live", reason: null, ready: true })
		this.startHandshake()
	}

	private reconcile(): void {
		const { noteDocument } = this.options
		const local = this.options.readLocalParts()
		if (noteDocument.isEmpty()) {
			if (local) noteDocument.seed(local)
			return
		}
		if (!local || sameNoteParts(local, noteDocument.readParts())) return
		if (this.snapshot.peers.length === 0 && this.snapshot.canWrite) {
			noteDocument.applyParts(local, RECONCILE_ORIGIN)
			return
		}
		if (this.options.hasUnsyncedLocalChanges()) this.options.takeSnapshot()
	}

	private publishAwarenessState(): void {
		const { user, fileSync = true, noteDocument } = this.options
		const previous = noteDocument.awareness.getLocalState() as CollabAwarenessState | null
		const state: CollabAwarenessState = {
			user: { ...user, ...collabUserColor(user.id) },
			session: this.sessionClientId ?? undefined,
			canWrite: this.snapshot.canWrite,
			fileSync,
			cursor: previous?.cursor ?? null,
		}
		noteDocument.awareness.setLocalState(state)
	}

	private answerStateVector(sender: string, stateVector: Uint8Array): void {
		if (!this.synced || !this.snapshot.canWrite) return
		const { doc, awareness } = this.options.noteDocument
		const states = awareness.getStates() as Map<number, CollabAwarenessState>
		if (electFileSyncLeader(states, sender) !== doc.clientID) return
		const update = Y.encodeStateAsUpdate(doc, stateVector)
		if (update.length > EMPTY_UPDATE_BYTES) this.send(COLLAB_OPS.update, update)
	}

	private handleDocumentUpdate = (update: Uint8Array, origin: unknown): void => {
		if (origin === REMOTE_ORIGIN || !this.synced || !this.snapshot.canWrite) return
		this.pendingUpdates.push(update)
		this.pendingBytes += update.length
		if (this.pendingBytes >= OUTGOING_FLUSH_BYTES) {
			this.flushUpdates()
			return
		}
		this.flushTimer ??= setTimeout(() => this.flushUpdates(), OUTGOING_FLUSH_DELAY_MS)
	}

	private flushUpdates(): void {
		if (this.flushTimer) clearTimeout(this.flushTimer)
		this.flushTimer = null
		const updates = this.pendingUpdates
		if (updates.length === 0) return
		this.pendingUpdates = []
		this.pendingBytes = 0
		this.send(COLLAB_OPS.update, updates.length === 1 ? updates[0] : Y.mergeUpdates(updates))
	}

	private handleAwarenessUpdate = (changes: AwarenessChanges, origin: unknown): void => {
		if (origin === REMOTE_ORIGIN) return
		const clientId = this.options.noteDocument.doc.clientID
		if (
			changes.added.includes(clientId) ||
			changes.updated.includes(clientId) ||
			changes.removed.includes(clientId)
		) {
			this.scheduleAwareness()
		}
	}

	private handleAwarenessChange = (): void => {
		this.updateRole()
		this.publish({})
	}

	private scheduleAwareness(): void {
		if (!this.synced) return
		if (this.awarenessTimer) {
			this.awarenessDirty = true
			return
		}
		this.awarenessDirty = false
		const { doc, awareness } = this.options.noteDocument
		this.send(COLLAB_OPS.awareness, encodeAwarenessUpdate(awareness, [doc.clientID]))
		this.awarenessTimer = setTimeout(() => {
			this.awarenessTimer = null
			if (this.awarenessDirty) this.scheduleAwareness()
		}, AWARENESS_THROTTLE_MS)
	}

	private forgetRemoteAwareness(clientIds: number[]): void {
		if (clientIds.length === 0) return
		const { awareness } = this.options.noteDocument
		removeAwarenessStates(awareness, clientIds, REMOTE_ORIGIN)
		for (const clientId of clientIds) awareness.meta.delete(clientId)
	}

	private removePeerAwareness(sessionClientId: string): void {
		const { awareness } = this.options.noteDocument
		const clientIds: number[] = []
		for (const [clientId, state] of awareness.getStates() as Map<number, CollabAwarenessState>) {
			if (state.session === sessionClientId && clientId !== awareness.clientID) {
				clientIds.push(clientId)
			}
		}
		this.forgetRemoteAwareness(clientIds)
	}

	private removeRemoteAwareness(): void {
		const { awareness } = this.options.noteDocument
		const clientIds = Array.from(awareness.getStates().keys()).filter(
			(clientId) => clientId !== awareness.clientID,
		)
		this.forgetRemoteAwareness(clientIds)
	}

	private updateRole(): void {
		if (this.disposed) return
		if (!this.synced) {
			this.setRole(this.snapshot.status === "unavailable" ? null : "follower")
			return
		}
		const { doc, awareness } = this.options.noteDocument
		const states = awareness.getStates() as Map<number, CollabAwarenessState>
		if (Date.now() < this.handshakeUntil && this.hasUnknownWriters(states)) {
			this.setRole("follower")
			return
		}
		const leader = electFileSyncLeader(states)
		this.setRole(leader === doc.clientID ? "leader" : "follower")
	}

	private hasUnknownWriters(states: ReadonlyMap<number, CollabAwarenessState>): boolean {
		const known = new Set<string>()
		for (const state of states.values()) if (state.session) known.add(state.session)
		return this.snapshot.peers.some((peer) => peer.canWrite && !known.has(peer.clientId))
	}

	private startHandshake(): void {
		this.clearHandshake()
		this.handshakeUntil = Date.now() + LEADER_HANDSHAKE_MS
		this.handshakeTimer = setTimeout(() => {
			this.handshakeTimer = null
			this.updateRole()
		}, LEADER_HANDSHAKE_MS)
		this.updateRole()
	}

	private clearHandshake(): void {
		if (this.handshakeTimer) clearTimeout(this.handshakeTimer)
		this.handshakeTimer = null
		this.handshakeUntil = 0
	}

	private setRole(role: CollabFileSyncRole | null): void {
		if (this.snapshot.role === role) return
		this.publish({ role })
		const { collab, vaultId, roomPath } = this.options
		void collab.setFileSyncRole(vaultId, roomPath, role).catch(() => {})
	}

	private isLastWriter(): boolean {
		return this.snapshot.canWrite && !this.snapshot.peers.some((peer) => peer.canWrite)
	}

	private handleClosed(reason: CollabCloseReason): void {
		this.resetConnection()
		if (this.disposed) return
		if (RECONNECT_REASONS.has(reason)) {
			this.publish({ status: "offline", reason, peers: NO_PEERS })
			this.setRole("follower")
			this.scheduleReconnect()
			return
		}
		this.publish({ status: "unavailable", reason, peers: NO_PEERS })
		this.setRole(null)
	}

	private resetConnection(): void {
		this.connection++
		this.channel = null
		this.synced = false
		this.queuedEvents = []
		this.pendingUpdates = []
		this.pendingBytes = 0
		if (this.flushTimer) clearTimeout(this.flushTimer)
		this.flushTimer = null
		this.clearHandshake()
		this.serverState?.destroy()
		this.serverState = null
		this.removeRemoteAwareness()
	}

	private scheduleReconnect(): void {
		this.clearReconnectTimer()
		const random = this.options.random ?? Math.random
		const base = Math.min(
			RECONNECT_MAX_DELAY_MS,
			RECONNECT_MIN_DELAY_MS * 2 ** this.reconnectAttempts,
		)
		this.reconnectAttempts++
		const delay = Math.min(RECONNECT_MAX_DELAY_MS, base * (0.8 + random() * 0.4))
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null
			void this.connect()
		}, delay)
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
		this.reconnectTimer = null
	}

	private send(op: CollabFrameOp, payload: Uint8Array): void {
		this.channel?.send(op, payload)
	}

	private publish(patch: SnapshotPatch): void {
		const current = this.snapshot
		const next = { ...current, ...patch }
		next.present = this.presentPeers(next.peers, current.present)
		const keys = Object.keys(next) as (keyof CollabSessionSnapshot)[]
		if (keys.every((key) => next[key] === current[key])) return
		this.snapshot = next
		for (const listener of this.listeners) listener()
	}

	private presentPeers(
		peers: readonly CollabPeer[],
		previous: readonly CollabPeer[],
	): readonly CollabPeer[] {
		if (peers.length === 0) return NO_PEERS
		const sessions = new Set<string>()
		const states = this.options.noteDocument.awareness.getStates() as Map<
			number,
			CollabAwarenessState
		>
		for (const state of states.values()) if (state.session) sessions.add(state.session)
		const present = peers.filter((peer) => sessions.has(peer.clientId))
		const unchanged =
			present.length === previous.length && present.every((peer, index) => peer === previous[index])
		return unchanged ? previous : present
	}
}
