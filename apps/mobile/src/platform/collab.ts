import { createCollabTransport } from "@cortex/core/collab-transport"
import type { CollabChannelEvent, Platform } from "@cortex/platform"
import { decodeVek } from "@cortex/sync-engine"
import * as ExpoCrypto from "expo-crypto"

import { secrets } from "./keychain"
import { serverApi } from "./serverApi"
import { setCollabFileRole } from "./sync"

const OWNER_ID = 1

const transport = createCollabTransport({ secrets, decodeVek, serverApi })
const listeners = new Map<string, (event: CollabChannelEvent) => void>()

const owner = {
	id: OWNER_ID,
	isDestroyed: () => false,
	emit: (channelId: string, event: CollabChannelEvent) => listeners.get(channelId)?.(event),
}

function reportCollabFailure(error: unknown): void {
	console.warn("[collab] channel request failed:", error)
}

export const collabApi = {
	availability: (vaultId) => transport.availability(vaultId),
	open: async (vaultId, roomPath, onEvent) => {
		const channelId = ExpoCrypto.randomUUID()
		let active = true
		const release = () => {
			if (!active) return false
			active = false
			listeners.delete(channelId)
			return true
		}
		listeners.set(channelId, (event) => {
			if (!active) return
			if (event.type === "closed") release()
			onEvent(event)
		})
		try {
			await transport.open(channelId, vaultId, roomPath, owner)
		} catch (error) {
			release()
			throw error
		}
		return {
			send: (op, payload) => {
				if (!active) return
				Promise.resolve(transport.send(channelId, OWNER_ID, op, payload)).catch(reportCollabFailure)
			},
			compact: (state, upTo) => {
				if (!active) return
				Promise.resolve(transport.compact(channelId, OWNER_ID, state, upTo)).catch(
					reportCollabFailure,
				)
			},
			close: () => {
				if (release())
					Promise.resolve(transport.close(channelId, OWNER_ID)).catch(reportCollabFailure)
			},
		}
	},
	setFileSyncRole: async (_vaultId, roomPath, role) => setCollabFileRole(roomPath, role),
} satisfies Platform["collab"]
