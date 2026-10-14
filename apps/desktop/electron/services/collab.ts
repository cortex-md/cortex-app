import { type CollabChannelOwner, createCollabTransport } from "@cortex/core/collab-transport"
import type { CollabFrameOp } from "@cortex/platform"
import { decodeVek } from "@cortex/sync-engine"
import type { WebContents } from "electron"
import type { MainApi } from "../contract"
import { EVENT_CHANNEL_PREFIX } from "../contract"
import { getInvokeSender } from "../ipc/sender"
import { resolveMainWindowId } from "../windows"
import { secrets, serverApi } from "./serverApi"
import { clearCollabRoles, setCollabRole } from "./syncBridge"

const transport = createCollabTransport({ secrets, decodeVek, serverApi })
const trackedOwners = new Set<number>()

function toOwner(contents: WebContents): CollabChannelOwner {
	return {
		id: contents.id,
		isDestroyed: () => contents.isDestroyed(),
		emit: (channelId, event) =>
			contents.send(`${EVENT_CHANNEL_PREFIX}collab-event`, { channelId, event }),
	}
}

function closeOwnerChannels(ownerId: number): void {
	transport.closeOwnerChannels(ownerId)
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

export const collabApi = {
	availability: (vaultId) => transport.availability(vaultId),
	open: async (channelId, vaultId, roomPath) => {
		const owner = requireSender()
		requireOwnerId()
		trackOwner(owner)
		await transport.open(channelId, vaultId, roomPath, toOwner(owner))
	},
	send: (channelId, op: CollabFrameOp, payload) =>
		transport.send(channelId, getInvokeSender()?.id, op, payload),
	compact: (channelId, state, upTo) =>
		transport.compact(channelId, getInvokeSender()?.id, state, upTo),
	close: (channelId) => transport.close(channelId, getInvokeSender()?.id),
	setFileSyncRole: async (_vaultId, roomPath, role) => {
		const owner = requireSender()
		const ownerId = requireOwnerId()
		if (ownerId === owner.id) trackOwner(owner)
		setCollabRole(ownerId, roomPath, role)
	},
} satisfies MainApi["collab"]
