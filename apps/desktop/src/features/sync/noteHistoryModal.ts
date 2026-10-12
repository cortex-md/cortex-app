import { createModalStore } from "@/utils/createModalStore"

export interface NoteHistoryTarget {
	filePath: string
}

export const noteHistoryModal = createModalStore<NoteHistoryTarget>()
