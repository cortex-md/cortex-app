import { useSyncExternalStore } from "react"

export type FilesSortOrder = "name" | "edited"

const listeners = new Set<() => void>()
let sortOrder: FilesSortOrder = "name"

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getSortOrder(): FilesSortOrder {
	return sortOrder
}

export function setFilesSortOrder(next: FilesSortOrder): void {
	if (next === sortOrder) return
	sortOrder = next
	for (const listener of listeners) listener()
}

export function useFilesSortOrder(): FilesSortOrder {
	return useSyncExternalStore(subscribe, getSortOrder, getSortOrder)
}

export const filesSortLabels: Record<FilesSortOrder, string> = {
	edited: "Sort by last edited",
	name: "Sort by name",
}
