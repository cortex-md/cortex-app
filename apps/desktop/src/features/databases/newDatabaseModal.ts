import { createModalStore } from "@/utils/createModalStore"

export interface NewDatabaseTarget {
	parentPath: string | null
	mode: "create" | "convert"
}

export const newDatabaseModal = createModalStore<NewDatabaseTarget>()
