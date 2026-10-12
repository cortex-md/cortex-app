import { createModalStore } from "@/utils/createModalStore"

export interface ManageAccessTarget {
	filePath: string
}

export const manageAccessModal = createModalStore<ManageAccessTarget>()
