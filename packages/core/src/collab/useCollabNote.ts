import { useEffect, useSyncExternalStore } from "react"
import {
	type CollabNoteState,
	getCollabNoteState,
	retainCollabNote,
	subscribeCollabNotes,
} from "./collabRuntime"

export function useCollabNoteState(filePath: string): CollabNoteState | null {
	return useSyncExternalStore(subscribeCollabNotes, () => getCollabNoteState(filePath))
}

export function useCollabNote(filePath: string, visible: boolean): CollabNoteState | null {
	useEffect(() => (visible ? retainCollabNote(filePath) : undefined), [filePath, visible])
	return useCollabNoteState(filePath)
}
