import { historyDayLabel, useRemoteVaultStore, useSyncStore, useVaultStore } from "@cortex/core"
import type { DeletedFileInfo } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { getBaseName, getParentPath } from "@cortex/platform/utils"
import { useEffect, useState, useSyncExternalStore } from "react"

export interface DeletedNote {
	id: string
	title: string
	folder: string
	deletedAt: number
	version: number
}

export interface DeletedNoteGroup {
	label: string
	notes: DeletedNote[]
}

interface DeletedNotesState {
	notes: DeletedNote[]
	loading: boolean
	error: string | null
}

const listeners = new Set<() => void>()
let state: DeletedNotesState = { notes: [], loading: false, error: null }

function setState(next: Partial<DeletedNotesState>): void {
	state = { ...state, ...next }
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getState(): DeletedNotesState {
	return state
}

function linkedTarget(): { vaultId: string; vaultPath: string } | null {
	const vaultPath = useVaultStore.getState().vault?.path
	const vaultId = useRemoteVaultStore.getState().linkedVaultId
	return vaultPath && vaultId ? { vaultId, vaultPath } : null
}

function toDeletedNote(file: DeletedFileInfo): DeletedNote {
	const folder = getParentPath(file.filePath)
	return {
		id: file.filePath,
		title: getBaseName(file.filePath).replace(/\.md$/i, ""),
		folder: folder || (useVaultStore.getState().vault?.name ?? "Vault"),
		deletedAt: file.deletedAt ? Date.parse(file.deletedAt) : 0,
		version: file.version,
	}
}

export async function loadDeletedNotes(): Promise<void> {
	const target = linkedTarget()
	if (!target) {
		setState({ notes: [], loading: false, error: "Link this vault to see deleted notes." })
		return
	}
	setState({ loading: true, error: null })
	try {
		const files = await useSyncStore.getState().listDeletedFiles(target.vaultId, target.vaultPath)
		const notes = files
			.filter((file) => /\.md$/i.test(file.filePath))
			.map(toDeletedNote)
			.sort((left, right) => right.deletedAt - left.deletedAt)
		setState({ notes, loading: false })
	} catch (error) {
		setState({ loading: false, error: error instanceof Error ? error.message : String(error) })
	}
}

export function useDeletedNotes(): DeletedNotesState {
	useEffect(() => {
		void loadDeletedNotes()
	}, [])
	return useSyncExternalStore(subscribe, getState, getState)
}

export function findDeletedNote(id: string | null): DeletedNote | null {
	return state.notes.find((note) => note.id === id) ?? null
}

export function useDeletedNoteBody(note: DeletedNote | null): string | null {
	const [body, setBody] = useState<{ id: string; text: string } | null>(null)
	useEffect(() => {
		const target = linkedTarget()
		if (!note || !target) return
		let canceled = false
		void useSyncStore
			.getState()
			.downloadVersion(target.vaultId, target.vaultPath, note.id, String(note.version))
			.then((text) => {
				if (!canceled) setBody({ id: note.id, text })
			})
			.catch(() => {
				if (!canceled) setBody({ id: note.id, text: "" })
			})
		return () => {
			canceled = true
		}
	}, [note])
	return body && note && body.id === note.id ? body.text : null
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

export function deletedMomentLabel(note: DeletedNote): string {
	const label = historyDayLabel(note.deletedAt).toLowerCase()
	const date = new Date(note.deletedAt)
	const time = date.toLocaleTimeString(undefined, {
		hour: "2-digit",
		hour12: false,
		minute: "2-digit",
	})
	if (label === "earlier") {
		return `${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })} at ${time}`
	}
	return `${label} at ${time}`
}

export async function restoreDeletedNote(note: DeletedNote): Promise<void> {
	const target = linkedTarget()
	if (!target) throw new Error("Link this vault to restore notes.")
	await useSyncStore.getState().restoreDeletedFile(target.vaultId, target.vaultPath, note.id)
	setState({ notes: state.notes.filter((candidate) => candidate.id !== note.id) })
}

export async function copyDeletedNoteText(text: string): Promise<void> {
	await getPlatform().clipboard.writeText(text)
}
