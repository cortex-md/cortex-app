import {
	COLLAB_MAX_FRAME_BYTES,
	decodeServerFrame,
	deriveCollabKey,
	encodeClientFrame,
	encodeCompactMessage,
	openCollabPayload,
	parseControlMessage,
	sealCollabPayload,
} from "@cortex/collab/wire"
import type {
	CollabAvailability,
	CollabChannelEvent,
	CollabCloseReason,
	CollabFrameOp,
	CollabPeer,
} from "@cortex/platform"
import { absoluteUrl, collabSocketUrl, createCollabTicket, SyncError } from "@cortex/sync-api"
import { decodeVek, vekSecretKey } from "@cortex/sync-engine"
import type { WebContents } from "electron"
import type { MainApi } from "../contract"
import { EVENT_CHANNEL_PREFIX } from "../contract"
import { getInvokeSender } from "../ipc/sender"
import { resolveMainWindowId } from "../windows"
import { secrets, serverApi } from "./serverApi"
import { clearCollabRoles, setCollabRole } from "./syncBridge"

const CAPABILITY_TTL_MS = 5 * 60_000
const CLOSE_TOO_LARGE = 1009
const CLOSE_NETWORK = 1006

const CLOSE_REASONS: Record<number, CollabCloseReason> = {
	1000: "normal",
	1001: "server-shutdown",
	1008: "room-full",
	1013: "buffer-full",
	4402: "subscription",
	4403: "access-changed",
	4408: "too-slow",
}

const HTTP_CLOSE_REASONS: Record<number, CollabCloseReason> = {
	401: "unauthorized",
	402: "subscription",
	403: "forbidden",
}

interface CollabChannelState {
	id: string
	owner: WebContents
	ownerId: number
	vaultId: string
	serverUrl: string
	key: Uint8Array
	socket: WebSocket | null
	closed: boolean
	decryptFailureLogged: boolean
}

const channels = new Map<string, CollabChannelState>()
const trackedOwners = new Set<number>()
const collabKeys = new Map<string, { encoded: string; key: Uint8Array }>()
const collabFeature = new Map<string, { enabled: boolean; checkedAt: number }>()

function emit(channel: CollabChannelState, event: CollabChannelEvent): void {
	if (channel.closed || channel.owner.isDestroyed()) return
	channel.owner.send(`${EVENT_CHANNEL_PREFIX}collab-event`, { channelId: channel.id, event })
}

function finish(channel: CollabChannelState, code: number, reason: CollabCloseReason): void {
	if (channel.closed) return
	emit(channel, { type: "closed", code, reason })
	dispose(channel)
}

function dispose(channel: CollabChannelState): void {
	channel.closed = true
	if (channels.get(channel.id) === channel) channels.delete(channel.id)
	const socket = channel.socket
	channel.socket = null
	if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000)
}

function closeOwnerChannels(ownerId: number): void {
	for (const channel of [...channels.values()]) {
		if (channel.ownerId === ownerId) dispose(channel)
	}
}

function resetOwner(contents: WebContents): void {
	closeOwnerChannels(contents.id)
	if (resolveMainWindowId(contents.id) === contents.id) clearCollabRoles(contents.id)
}

function trackOwner(contents: WebContents): void {
	if (trackedOwners.has(contents.id)) return
	const contentsId = contents.id
	trackedOwners.add(contentsId)
	contents.on("did-start-navigation", (details) => {
		if (details.isMainFrame && !details.isSameDocument) resetOwner(contents)
	})
	contents.once("destroyed", () => {
		trackedOwners.delete(contentsId)
		closeOwnerChannels(contentsId)
		clearCollabRoles(contentsId)
	})
}

function requireSender(): WebContents {
	const sender = getInvokeSender()
	if (!sender) throw new Error("Collaboration requests must come from an app window")
	return sender
}

function requireOwnerId(): number {
	const sender = requireSender()
	const ownerId = resolveMainWindowId(sender.id)
	if (ownerId === null) throw new Error("Collaboration requests must come from an app window")
	return ownerId
}

function ownedChannel(channelId: string): CollabChannelState | null {
	const channel = channels.get(channelId)
	return channel && channel.ownerId === getInvokeSender()?.id ? channel : null
}

function collabKey(vaultId: string): Uint8Array | null {
	const encoded = secrets.get(vekSecretKey(vaultId))
	if (!encoded) {
		collabKeys.delete(vaultId)
		return null
	}
	const cached = collabKeys.get(vaultId)
	if (cached?.encoded === encoded) return cached.key
	const key = deriveCollabKey(decodeVek(encoded))
	collabKeys.set(vaultId, { encoded, key })
	return key
}

async function collabEnabled(serverUrl: string): Promise<boolean> {
	const cached = collabFeature.get(serverUrl)
	if (cached && Date.now() - cached.checkedAt < CAPABILITY_TTL_MS) return cached.enabled
	try {
		const capabilities = await serverApi.account.getCapabilities(serverUrl)
		collabFeature.set(serverUrl, { enabled: capabilities.features.collab, checkedAt: Date.now() })
		return capabilities.features.collab
	} catch {
		return cached?.enabled ?? true
	}
}

function ticketFailureReason(error: unknown): CollabCloseReason {
	return error instanceof SyncError && error.status !== null
		? (HTTP_CLOSE_REASONS[error.status] ?? "network")
		: "network"
}

function sendFrame(channel: CollabChannelState, frame: Uint8Array | string): void {
	const socket = channel.socket
	if (!socket || socket.readyState !== WebSocket.OPEN) return
	socket.send(frame)
}

function withServerAvatar(peer: CollabPeer, serverUrl: string): CollabPeer {
	return { ...peer, avatarUrl: absoluteUrl(serverUrl, peer.avatarUrl) }
}

function withAbsoluteAvatars<T extends CollabChannelEvent>(event: T, serverUrl: string): T {
	if (event.type === "peer-joined")
		return { ...event, peer: withServerAvatar(event.peer, serverUrl) }
	if (event.type !== "welcome") return event
	const { welcome } = event
	return {
		...event,
		welcome: {
			...welcome,
			self: withServerAvatar(welcome.self, serverUrl),
			peers: welcome.peers.map((peer) => withServerAvatar(peer, serverUrl)),
		},
	}
}

function handleMessage(channel: CollabChannelState, data: unknown): void {
	if (typeof data === "string") {
		const message = parseControlMessage(data)
		if (!message || message.type === "ping") return
		emit(channel, withAbsoluteAvatars(message, channel.serverUrl))
		return
	}
	if (!(data instanceof ArrayBuffer)) return
	const frame = decodeServerFrame(new Uint8Array(data))
	if (!frame) return
	try {
		const payload = openCollabPayload(channel.key, channel.vaultId, frame.payload)
		emit(channel, { type: "frame", op: frame.op, sender: frame.sender, payload })
	} catch {
		if (channel.decryptFailureLogged) return
		channel.decryptFailureLogged = true
		console.warn(`[collab] dropped undecryptable frames on vault ${channel.vaultId}`)
	}
}

function connect(channel: CollabChannelState, url: string): void {
	let socket: WebSocket
	try {
		socket = new WebSocket(url)
	} catch {
		finish(channel, CLOSE_NETWORK, "network")
		return
	}
	socket.binaryType = "arraybuffer"
	channel.socket = socket
	socket.addEventListener("message", (event) => {
		if (channel.socket === socket) handleMessage(channel, event.data)
	})
	socket.addEventListener("close", (event) => {
		if (channel.socket !== socket) return
		channel.socket = null
		finish(channel, event.code, CLOSE_REASONS[event.code] ?? "network")
	})
}

export const collabApi = {
	availability: async (vaultId): Promise<CollabAvailability> => {
		const serverUrl = await serverApi.selectServerUrl()
		if (!serverUrl || !(await serverApi.currentUserId(serverUrl))) return "signed-out"
		if (!(await collabEnabled(serverUrl))) return "feature-disabled"
		return secrets.get(vekSecretKey(vaultId)) ? "ready" : "locked"
	},
	open: async (channelId, vaultId, roomPath) => {
		const owner = requireSender()
		requireOwnerId()
		if (channels.has(channelId)) throw new Error("Collaboration channel already open")
		const key = collabKey(vaultId)
		if (!key) throw new Error("Unlock this vault before collaborating")
		trackOwner(owner)
		const channel: CollabChannelState = {
			id: channelId,
			owner,
			ownerId: owner.id,
			vaultId,
			serverUrl: "",
			key,
			socket: null,
			closed: false,
			decryptFailureLogged: false,
		}
		channels.set(channelId, channel)
		let url: string
		try {
			const api = await serverApi.client()
			channel.serverUrl = api.serverUrl
			const { ticket } = await createCollabTicket(api, vaultId, roomPath)
			url = collabSocketUrl(api.serverUrl, vaultId, roomPath, ticket)
		} catch (error) {
			finish(channel, CLOSE_NETWORK, ticketFailureReason(error))
			return
		}
		if (!channel.closed) connect(channel, url)
	},
	send: async (channelId, op: CollabFrameOp, payload) => {
		const channel = ownedChannel(channelId)
		if (!channel) return
		const frame = encodeClientFrame(op, sealCollabPayload(channel.key, channel.vaultId, payload))
		if (frame.length > COLLAB_MAX_FRAME_BYTES) {
			finish(channel, CLOSE_TOO_LARGE, "too-large")
			return
		}
		sendFrame(channel, frame)
	},
	compact: async (channelId, state, upTo) => {
		const channel = ownedChannel(channelId)
		if (!channel) return
		const message = encodeCompactMessage(
			sealCollabPayload(channel.key, channel.vaultId, state),
			upTo,
		)
		if (message.length > COLLAB_MAX_FRAME_BYTES) {
			console.warn(`[collab] skipped oversized compaction on vault ${channel.vaultId}`)
			return
		}
		sendFrame(channel, message)
	},
	close: async (channelId) => {
		const channel = ownedChannel(channelId)
		if (channel) dispose(channel)
	},
	setFileSyncRole: async (_vaultId, roomPath, role) => {
		const owner = requireSender()
		const ownerId = requireOwnerId()
		if (ownerId === owner.id) trackOwner(owner)
		setCollabRole(ownerId, roomPath, role)
	},
} satisfies MainApi["collab"]
