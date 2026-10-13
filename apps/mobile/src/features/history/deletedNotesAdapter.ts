import { historyDayLabel, useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { joinPath } from "@cortex/platform/utils"
import { useSyncExternalStore } from "react"

import { FIXTURE_DELETED_NOTES, type FixtureDeletedNote } from "@/features/history/historyFixtures"

const MINUTE_MS = 60_000
const RETENTION_WARNING_DAYS = 7

export interface DeletedNote {
	id: string
	title: string
	folder: string
	deletedAt: number
	who: string
	device: string
	daysLeft: number
	expiresSoon: boolean
	body: string
}

export interface DeletedNoteGroup {
	label: string
	notes: DeletedNote[]
}

const createdAt = Date.now()
const listeners = new Set<() => void>()
let restoredIds: ReadonlySet<string> = new Set()

function notify(): void {
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getRestoredIds(): ReadonlySet<string> {
	return restoredIds
}

function toDeletedNote(fixture: FixtureDeletedNote): DeletedNote {
	return {
		id: fixture.id,
		title: fixture.title,
		folder: fixture.folder,
		deletedAt: createdAt - fixture.deletedMinutesAgo * MINUTE_MS,
		who: fixture.who,
		device: fixture.device,
		daysLeft: fixture.daysLeft,
		expiresSoon: fixture.daysLeft <= RETENTION_WARNING_DAYS,
		body: fixture.body,
	}
}

const DELETED_NOTES = FIXTURE_DELETED_NOTES.map(toDeletedNote)

export function useDeletedNotes(): DeletedNote[] {
	// stub: the remote trash comes from the sync server; fixtures stand in until it runs on mobile
	const restored = useSyncExternalStore(subscribe, getRestoredIds, getRestoredIds)
	return DELETED_NOTES.filter((note) => !restored.has(note.id))
}

export function findDeletedNote(id: string | null): DeletedNote | null {
	return DELETED_NOTES.find((note) => note.id === id) ?? null
}

export function groupDeletedNotes(notes: readonly DeletedNote[]): DeletedNoteGroup[] {
	const now = Date.now()
	const groups: DeletedNoteGroup[] = []
	for (const note of notes) {
		const label = historyDayLabel(note.deletedAt, now)
		const last = groups.at(-1)
		if (last?.label === label) last.notes.push(note)
		else groups.push({ label, notes: [note] })
	}
	return groups
}

export function retentionLabel(note: DeletedNote): string {
	const days = `${note.daysLeft} ${note.daysLeft === 1 ? "day" : "days"}`
	return note.expiresSoon ? `Removed in ${days}` : `${days} left`
}

export function deletedMomentLabel(note: DeletedNote): string {
	const label = historyDayLabel(note.deletedAt).toLowerCase()
	const date = new Date(note.deletedAt)
	const time = date.toLocaleTimeString(undefined, { hour: "2-digit", hour12: false, minute: "2-digit" })
	if (label === "earlier") {
		return `${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })} at ${time}`
	}
	return `${label} at ${time}`
}

async function writeRestoredNote(note: DeletedNote): Promise<string> {
	const vaultStore = useVaultStore.getState()
	const vaultPath = vaultStore.vault?.path
	if (!vaultPath) throw new Error("Open a vault to restore notes.")
	const folderPath = joinPath(vaultPath, note.folder)
	try {
		return await vaultStore.createFileWithContent(folderPath, note.title, note.body)
	} catch {
		return vaultStore.createFileWithContent(vaultPath, note.title, note.body)
	}
}

export async function restoreDeletedNote(note: DeletedNote): Promise<string> {
	// stub: the remote trash is a fixture; the note is recreated locally from its last synced text
	const filePath = await writeRestoredNote(note)
	restoredIds = new Set([...restoredIds, note.id])
	notify()
	return filePath
}

export async function copyDeletedNoteText(note: DeletedNote): Promise<void> {
	await getPlatform().clipboard.writeText(note.body)
}
