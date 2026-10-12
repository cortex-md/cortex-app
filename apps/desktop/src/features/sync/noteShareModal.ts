import { createModalStore } from "@/utils/createModalStore"

export interface NoteShareTarget {
	filePath: string
}

export const noteShareModal = createModalStore<NoteShareTarget>()
