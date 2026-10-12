import type { LucideIcon as LucideIconType } from "lucide-react"

export type SidebarViewSource = "core" | "extension"

export interface SidebarViewItem {
	id: string
	viewId?: string
	icon: LucideIconType | string
	label: string
	source: SidebarViewSource
	draggable?: boolean
}

export interface SidebarViewPanelProps {
	id: string
}

type SidebarViewDirection = "backward" | "forward"

export function getAvailableSidebarViewId(items: SidebarViewItem[], requestedId: string): string {
	return items.some((item) => item.id === requestedId) ? requestedId : "files"
}

export function getSidebarViewDirection(
	items: SidebarViewItem[],
	fromId: string,
	toId: string,
): SidebarViewDirection {
	const fromIndex = items.findIndex((item) => item.id === fromId)
	const toIndex = items.findIndex((item) => item.id === toId)
	return fromIndex !== -1 && toIndex < fromIndex ? "backward" : "forward"
}
