import type { CollabFrameOp, CollabPeer, CollabWelcome } from "@cortex/platform"

export const COLLAB_OPS = {
	syncStep1: 1,
	syncStep2: 2,
	update: 3,
	awareness: 4,
} as const satisfies Record<string, CollabFrameOp>

export const COLLAB_MAX_FRAME_BYTES = 2 * 1024 * 1024 - 64

export interface CollabServerFrame {
	op: CollabFrameOp
	sender: string
	payload: Uint8Array
}

export type CollabControlMessage =
	| { type: "welcome"; welcome: CollabWelcome }
	| { type: "synced" }
	| { type: "peer-joined"; peer: CollabPeer }
	| { type: "peer-left"; clientId: string }
	| { type: "ping" }

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

export function isCollabFrameOp(value: unknown): value is CollabFrameOp {
	return value === 1 || value === 2 || value === 3 || value === 4
}

export function encodeClientFrame(op: CollabFrameOp, payload: Uint8Array): Uint8Array<ArrayBuffer> {
	const frame = new Uint8Array(payload.length + 1)
	frame[0] = op
	frame.set(payload, 1)
	return frame
}

export function decodeServerFrame(bytes: Uint8Array): CollabServerFrame | null {
	if (bytes.length < 2) return null
	const op = bytes[0]
	const senderLength = bytes[1] ?? 0
	if (!isCollabFrameOp(op) || bytes.length < 2 + senderLength) return null
	return {
		op,
		sender: String.fromCharCode(...bytes.subarray(2, 2 + senderLength)),
		payload: bytes.subarray(2 + senderLength),
	}
}

function toRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function parsePeer(value: unknown): CollabPeer | null {
	const raw = toRecord(value)
	if (typeof raw.client_id !== "string" || !raw.client_id) return null
	return {
		clientId: raw.client_id,
		userId: typeof raw.user_id === "string" ? raw.user_id : "",
		displayName: typeof raw.display_name === "string" ? raw.display_name : "",
		avatarUrl: typeof raw.avatar_url === "string" && raw.avatar_url ? raw.avatar_url : null,
		canWrite: raw.can_write === true,
	}
}

export function parseControlMessage(text: string): CollabControlMessage | null {
	let raw: Record<string, unknown>
	try {
		raw = toRecord(JSON.parse(text))
	} catch {
		return null
	}
	switch (raw.type) {
		case "welcome": {
			const self = parsePeer(raw.from)
			const clientId = typeof raw.client_id === "string" ? raw.client_id : self?.clientId
			if (!self || !clientId) return null
			const peers = Array.isArray(raw.peers) ? raw.peers.map(parsePeer) : []
			return {
				type: "welcome",
				welcome: {
					clientId,
					upTo: typeof raw.up_to === "number" ? raw.up_to : 0,
					self,
					peers: peers.filter((peer): peer is CollabPeer => peer !== null),
				},
			}
		}
		case "synced":
			return { type: "synced" }
		case "ping":
			return { type: "ping" }
		case "peer_joined": {
			const peer = parsePeer(raw.peer)
			return peer ? { type: "peer-joined", peer } : null
		}
		case "peer_left":
			return typeof raw.client_id === "string" && raw.client_id
				? { type: "peer-left", clientId: raw.client_id }
				: null
		default:
			return null
	}
}

export function encodeBase64(bytes: Uint8Array): string {
	let output = ""
	let index = 0
	for (; index + 2 < bytes.length; index += 3) {
		const chunk =
			((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0)
		output +=
			BASE64_ALPHABET[chunk >> 18] +
			BASE64_ALPHABET[(chunk >> 12) & 63] +
			BASE64_ALPHABET[(chunk >> 6) & 63] +
			BASE64_ALPHABET[chunk & 63]
	}
	const remaining = bytes.length - index
	if (remaining === 1) {
		const chunk = (bytes[index] ?? 0) << 16
		output += `${BASE64_ALPHABET[chunk >> 18]}${BASE64_ALPHABET[(chunk >> 12) & 63]}==`
	} else if (remaining === 2) {
		const chunk = ((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8)
		output += `${BASE64_ALPHABET[chunk >> 18]}${BASE64_ALPHABET[(chunk >> 12) & 63]}${BASE64_ALPHABET[(chunk >> 6) & 63]}=`
	}
	return output
}

export function encodeCompactMessage(sealedState: Uint8Array, upTo: number): string {
	return JSON.stringify({ type: "compact", data: encodeBase64(sealedState), up_to: upTo })
}
