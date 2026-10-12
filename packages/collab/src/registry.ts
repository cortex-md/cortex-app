import type { Collab } from "@cortex/platform"
import { RELEASE_GRACE_MS } from "./constants"
import { CollabNoteDocument, type CollabNoteParts } from "./document"
import { CollabSession, type CollabSessionUser } from "./session"

export interface CollabRoom {
	vaultId: string
	roomPath: string
}

export interface CollabRegistryEntry {
	filePath: string
	room: CollabRoom
	noteDocument: CollabNoteDocument
	session: CollabSession
}

export interface CollabRegistryOptions {
	collab: Collab
	resolveRoom: (filePath: string) => CollabRoom | null
	resolveUser: () => CollabSessionUser | null
	fileSync?: boolean
	readLocalParts: (filePath: string) => CollabNoteParts | null
	hasUnsyncedLocalChanges: (filePath: string) => boolean
	takeSnapshot: (filePath: string) => void
	attach?: (entry: CollabRegistryEntry) => () => void
	graceMs?: number
}

export interface CollabRegistry {
	retain: (filePath: string) => CollabRegistryEntry | null
	release: (entry: CollabRegistryEntry) => void
	get: (filePath: string) => CollabRegistryEntry | undefined
	subscribe: (listener: () => void) => () => void
	rename: (oldPath: string, newPath: string) => void
	close: (filePath: string) => void
	closeAll: () => void
}

interface NoteLocation {
	filePath: string
}

interface RegistryRecord {
	location: NoteLocation
	entry: CollabRegistryEntry
	references: number
	releaseTimer: ReturnType<typeof setTimeout> | null
	detach: (() => void) | null
}

export function createCollabRegistry(options: CollabRegistryOptions): CollabRegistry {
	const records = new Map<string, RegistryRecord>()
	const recordsByDocument = new Map<CollabNoteDocument, RegistryRecord>()
	const listeners = new Set<() => void>()
	const graceMs = options.graceMs ?? RELEASE_GRACE_MS

	const notify = () => {
		for (const listener of listeners) listener()
	}

	const createSession = (
		location: NoteLocation,
		noteDocument: CollabNoteDocument,
		room: CollabRoom,
		user: CollabSessionUser,
	): CollabSession =>
		new CollabSession({
			collab: options.collab,
			vaultId: room.vaultId,
			roomPath: room.roomPath,
			noteDocument,
			user,
			fileSync: options.fileSync,
			readLocalParts: () => options.readLocalParts(location.filePath),
			hasUnsyncedLocalChanges: () => options.hasUnsyncedLocalChanges(location.filePath),
			takeSnapshot: () => options.takeSnapshot(location.filePath),
		})

	const activate = (record: RegistryRecord) => {
		record.detach = options.attach?.(record.entry) ?? null
		record.entry.session.start()
	}

	const shutdown = (record: RegistryRecord, compact: boolean) => {
		if (record.releaseTimer) clearTimeout(record.releaseTimer)
		record.releaseTimer = null
		record.entry.session.dispose({ compact })
		record.detach?.()
		record.detach = null
	}

	const close = (filePath: string) => {
		const record = records.get(filePath)
		if (!record) return
		records.delete(filePath)
		recordsByDocument.delete(record.entry.noteDocument)
		shutdown(record, true)
		record.entry.noteDocument.destroy()
		notify()
	}

	return {
		retain: (filePath) => {
			const existing = records.get(filePath)
			if (existing) {
				existing.references++
				if (existing.releaseTimer) clearTimeout(existing.releaseTimer)
				existing.releaseTimer = null
				existing.entry.session.setActive(true)
				return existing.entry
			}
			const room = options.resolveRoom(filePath)
			const user = options.resolveUser()
			if (!room || !user) return null
			const noteDocument = new CollabNoteDocument()
			const location = { filePath }
			const record: RegistryRecord = {
				location,
				entry: {
					filePath,
					room,
					noteDocument,
					session: createSession(location, noteDocument, room, user),
				},
				references: 1,
				releaseTimer: null,
				detach: null,
			}
			records.set(filePath, record)
			recordsByDocument.set(noteDocument, record)
			activate(record)
			notify()
			return record.entry
		},
		release: (entry) => {
			const record = recordsByDocument.get(entry.noteDocument)
			if (!record || record.references === 0) return
			record.references--
			if (record.references > 0) return
			record.entry.session.setActive(false)
			record.releaseTimer = setTimeout(() => close(record.location.filePath), graceMs)
		},
		get: (filePath) => records.get(filePath)?.entry,
		subscribe: (listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
		rename: (oldPath, newPath) => {
			if (oldPath === newPath) return
			const record = records.get(oldPath)
			if (!record) return
			const room = options.resolveRoom(newPath)
			const user = options.resolveUser()
			if (records.has(newPath) || !room || !user) {
				close(oldPath)
				return
			}
			const releaseTimer = record.releaseTimer
			record.releaseTimer = null
			shutdown(record, false)
			records.delete(oldPath)
			const { noteDocument } = record.entry
			record.location = { filePath: newPath }
			record.entry = {
				filePath: newPath,
				room,
				noteDocument,
				session: createSession(record.location, noteDocument, room, user),
			}
			records.set(newPath, record)
			activate(record)
			if (releaseTimer) record.releaseTimer = setTimeout(() => close(newPath), graceMs)
			notify()
		},
		close,
		closeAll: () => {
			for (const filePath of Array.from(records.keys())) close(filePath)
		},
	}
}
