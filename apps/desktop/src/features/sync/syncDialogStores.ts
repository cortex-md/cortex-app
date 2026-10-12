import { createModalStore } from "@/utils/createModalStore"

export interface SyncConflictTarget {
	relativePath: string
}

export const syncLogsModal = createModalStore<true>()
export const deletedNotesModal = createModalStore<true>()
export const syncConflictModal = createModalStore<SyncConflictTarget>()
