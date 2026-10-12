import {
	type CollabNoteDocument,
	type CollabRegistryEntry,
	type CollabSessionSnapshot,
	EXTERNAL_ORIGIN,
} from "@cortex/collab"
import { noteCache } from "../noteCache"
import { joinNoteParts, splitNoteParts } from "./noteParts"

type DocumentTransaction = Parameters<CollabNoteDocument["isLocalEditorTransaction"]>[0]

function isLiveSnapshot(snapshot: CollabSessionSnapshot): boolean {
	return snapshot.ready && snapshot.status !== "unavailable" && snapshot.status !== "closed"
}

export function attachCollabPersistence({ filePath, noteDocument, session }: CollabRegistryEntry) {
	let disposed = false
	let live = false
	let flushQueued = false
	let localChanges = false
	let remoteChanges = false
	let lastWrittenContent: string | null = null
	let lastStatus = session.getSnapshot().status
	let detachLiveDocument: (() => void) | null = null

	const canWrite = () => session.getSnapshot().canWrite

	const writeDocument = () => {
		flushQueued = false
		const prepare = localChanges
		const notify = remoteChanges
		localChanges = false
		remoteChanges = false
		if (disposed || !live) return
		const content = joinNoteParts(noteDocument.readParts())
		lastWrittenContent = content
		noteCache.writeLive(filePath, content, { persist: canWrite(), prepare, notify })
	}

	const queueWrite = () => {
		if (flushQueued) return
		flushQueued = true
		queueMicrotask(writeDocument)
	}

	const applyExternalContent = (content: string) => {
		if (disposed || !live || !canWrite() || content === lastWrittenContent) return
		noteDocument.applyParts(splitNoteParts(content), EXTERNAL_ORIGIN)
	}

	const handleTransaction = (transaction: DocumentTransaction) => {
		if (!live || transaction.changed.size === 0) return
		if (noteDocument.isLocalEditorTransaction(transaction)) localChanges = true
		else remoteChanges = true
		queueWrite()
	}

	const handleSnapshot = () => {
		const snapshot = session.getSnapshot()
		const nextLive = isLiveSnapshot(snapshot)
		const becameLive = snapshot.status === "live" && lastStatus !== "live"
		lastStatus = snapshot.status
		if (nextLive !== live) {
			if (flushQueued) writeDocument()
			live = nextLive
			if (live) {
				detachLiveDocument = noteCache.attachLiveDocument(filePath, { applyExternalContent })
			} else {
				detachLiveDocument?.()
				detachLiveDocument = null
				if (!snapshot.canWrite) noteCache.restoreDiskContent(filePath)
			}
		}
		if (live && becameLive) {
			remoteChanges = true
			queueWrite()
		}
	}

	noteDocument.doc.on("afterTransaction", handleTransaction)
	const unsubscribeContent = noteCache.onContentChange(filePath, (_path, content) =>
		applyExternalContent(content),
	)
	const unsubscribeSession = session.subscribe(handleSnapshot)
	handleSnapshot()

	return () => {
		if (disposed) return
		const wasLive = live
		const writable = canWrite()
		disposed = true
		live = false
		noteDocument.doc.off("afterTransaction", handleTransaction)
		unsubscribeContent()
		unsubscribeSession()
		detachLiveDocument?.()
		detachLiveDocument = null
		if (wasLive && !writable) noteCache.restoreDiskContent(filePath)
	}
}
