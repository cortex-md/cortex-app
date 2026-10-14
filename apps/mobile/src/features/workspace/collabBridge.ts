import { type CollabNoteBinding, useCollabNote } from "@cortex/core"
import { fromBase64, toBase64 } from "@cortex/sync-engine"
import { useEffect } from "react"
import { applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness"
import * as Y from "yjs"

import type { CollabBridgeMessage } from "@/features/workspace/workspaceProtocol"

const BRIDGE_ORIGIN = "mobile-webview"
const FLUSH_DELAY_MS = 16

type Send = (message: CollabBridgeMessage) => void

interface UserState {
	user?: { name?: string; color?: string; colorLight?: string }
}

interface AttachedMirror {
	filePath: string
	binding: CollabNoteBinding
	receive(message: CollabBridgeMessage): void
	dispose(): void
}

let attached: AttachedMirror | null = null

export function receiveCollabBridgeMessage(message: CollabBridgeMessage): void {
	if (attached && attached.filePath === message.filePath) attached.receive(message)
}

function remoteClients(binding: CollabNoteBinding): number[] {
	const self = binding.awareness.clientID
	return [...binding.awareness.getStates().keys()].filter((clientId) => clientId !== self)
}

function attachMirror(
	filePath: string,
	binding: CollabNoteBinding,
	canWrite: boolean,
	send: Send,
): AttachedMirror {
	const doc = binding.text.doc
	if (!doc) throw new Error("Collaborative note has no document")
	const { awareness, undoManager } = binding
	undoManager.trackedOrigins.add(BRIDGE_ORIGIN)
	let pending: Uint8Array[] = []
	let timer: ReturnType<typeof setTimeout> | null = null

	const flush = () => {
		timer = null
		if (pending.length === 0) return
		const update = pending.length === 1 ? pending[0] : Y.mergeUpdates(pending)
		pending = []
		if (update) send({ kind: "update", filePath, update: toBase64(update) })
	}

	const handleUpdate = (update: Uint8Array, origin: unknown) => {
		if (origin === BRIDGE_ORIGIN) return
		pending.push(update)
		timer ??= setTimeout(flush, FLUSH_DELAY_MS)
	}

	const handleAwareness = (
		{ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
		origin: unknown,
	) => {
		if (origin === BRIDGE_ORIGIN) return
		const changed = [...added, ...updated, ...removed].filter((id) => id !== awareness.clientID)
		if (changed.length === 0) return
		send({
			kind: "peers",
			filePath,
			update: toBase64(encodeAwarenessUpdate(awareness, changed)),
		})
	}

	const localUser = (awareness.getLocalState() as UserState | null)?.user
	const peers = remoteClients(binding)
	send({
		kind: "attach",
		filePath,
		update: toBase64(Y.encodeStateAsUpdate(doc)),
		peers: peers.length > 0 ? toBase64(encodeAwarenessUpdate(awareness, peers)) : null,
		canWrite,
		user: {
			name: localUser?.name ?? "You",
			color: localUser?.color ?? "#5b6ee1",
			colorLight: localUser?.colorLight ?? "#5b6ee133",
		},
	})
	doc.on("update", handleUpdate)
	awareness.on("update", handleAwareness)

	return {
		filePath,
		binding,
		receive(message) {
			switch (message.kind) {
				case "update":
					Y.applyUpdate(doc, fromBase64(message.update), BRIDGE_ORIGIN)
					return
				case "cursor":
					awareness.setLocalStateField("cursor", message.cursor)
					return
				case "peers":
					applyAwarenessUpdate(awareness, fromBase64(message.update), BRIDGE_ORIGIN)
					return
				default:
					return
			}
		},
		dispose() {
			if (timer) clearTimeout(timer)
			flush()
			doc.off("update", handleUpdate)
			awareness.off("update", handleAwareness)
			undoManager.trackedOrigins.delete(BRIDGE_ORIGIN)
			awareness.setLocalStateField("cursor", null)
			send({ kind: "detach", filePath })
		},
	}
}

export function useNoteCollabBridge(
	filePath: string | null,
	visible: boolean,
	send: Send,
): boolean {
	const collab = useCollabNote(filePath ?? "", Boolean(filePath) && visible)
	const binding = filePath ? (collab?.binding ?? null) : null
	const canWrite = collab?.snapshot.canWrite ?? false

	useEffect(() => {
		if (!filePath || !binding) return
		attached?.dispose()
		const mirror = attachMirror(filePath, binding, canWrite, send)
		attached = mirror
		return () => {
			mirror.dispose()
			if (attached === mirror) attached = null
		}
	}, [binding, canWrite, filePath, send])

	return binding !== null
}
