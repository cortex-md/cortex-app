import type { CollabEditorBinding } from "@cortex/editor/collab"
import { Awareness, applyAwarenessUpdate } from "y-protocols/awareness"
import * as Y from "yjs"

import type { CollabBridgeMessage, CollabCursorState } from "@/features/workspace/workspaceProtocol"

const NATIVE_ORIGIN = "native"
const FLUSH_DELAY_MS = 16

export interface CollabMirrorState {
	filePath: string
	binding: CollabEditorBinding
	canWrite: boolean
}

interface MirrorSession {
	state: CollabMirrorState
	dispose(): void
}

function encodeBase64(bytes: Uint8Array): string {
	let binary = ""
	const chunk = 0x8000
	for (let index = 0; index < bytes.length; index += chunk) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
	}
	return btoa(binary)
}

function decodeBase64(value: string): Uint8Array {
	const binary = atob(value)
	const bytes = new Uint8Array(binary.length)
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
	return bytes
}

export function createCollabMirror(send: (message: CollabBridgeMessage) => void) {
	const listeners = new Set<() => void>()
	let session: MirrorSession | null = null

	const notify = () => {
		for (const listener of listeners) listener()
	}

	function open(message: Extract<CollabBridgeMessage, { kind: "attach" }>): MirrorSession {
		const { filePath } = message
		const doc = new Y.Doc()
		Y.applyUpdate(doc, decodeBase64(message.update), NATIVE_ORIGIN)
		const awareness = new Awareness(doc)
		awareness.setLocalStateField("user", message.user)
		if (message.peers) applyAwarenessUpdate(awareness, decodeBase64(message.peers), NATIVE_ORIGIN)
		const text = doc.getText("body")
		const undoManager = new Y.UndoManager(text, { trackedOrigins: new Set() })
		let pending: Uint8Array[] = []
		let timer: ReturnType<typeof setTimeout> | null = null
		let lastCursor = ""

		const flush = () => {
			timer = null
			if (pending.length === 0) return
			const update = pending.length === 1 ? pending[0] : Y.mergeUpdates(pending)
			pending = []
			if (update) send({ kind: "update", filePath, update: encodeBase64(update) })
		}

		const handleUpdate = (update: Uint8Array, origin: unknown) => {
			if (origin === NATIVE_ORIGIN) return
			pending.push(update)
			timer ??= setTimeout(flush, FLUSH_DELAY_MS)
		}

		const handleLocalAwareness = () => {
			const local = awareness.getLocalState() as { cursor?: CollabCursorState | null } | null
			const cursor = local?.cursor ?? null
			const serialized = JSON.stringify(cursor)
			if (serialized === lastCursor) return
			lastCursor = serialized
			send({ kind: "cursor", filePath, cursor })
		}

		doc.on("update", handleUpdate)
		awareness.on("change", handleLocalAwareness)

		return {
			state: {
				filePath,
				canWrite: message.canWrite,
				binding: { text, awareness, undoManager },
			},
			dispose() {
				if (timer) clearTimeout(timer)
				flush()
				doc.off("update", handleUpdate)
				awareness.off("change", handleLocalAwareness)
				undoManager.destroy()
				awareness.destroy()
				doc.destroy()
			},
		}
	}

	return {
		receive(message: CollabBridgeMessage): void {
			switch (message.kind) {
				case "attach":
					session?.dispose()
					session = open(message)
					notify()
					return
				case "detach":
					if (session?.state.filePath !== message.filePath) return
					session.dispose()
					session = null
					notify()
					return
			}
			const current = session
			if (!current || current.state.filePath !== message.filePath) return
			const { awareness, text } = current.state.binding
			const doc = text.doc
			if (message.kind === "update" && doc) {
				Y.applyUpdate(doc, decodeBase64(message.update), NATIVE_ORIGIN)
				return
			}
			if (message.kind === "peers") {
				applyAwarenessUpdate(awareness, decodeBase64(message.update), NATIVE_ORIGIN)
			}
		},
		getState(): CollabMirrorState | null {
			return session?.state ?? null
		},
		subscribe(listener: () => void): () => void {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
		dispose(): void {
			session?.dispose()
			session = null
		},
	}
}
