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

interface SidebarViewButtonLayout {
	left: number
	width: number
}

interface SidebarViewScrollLayout {
	activeIndex: number
	buttons: SidebarViewButtonLayout[]
	viewportWidth: number
	scrollWidth: number
	paddingStart?: number
	paddingEnd?: number
}

export function calculateSidebarViewScrollLeft({
	activeIndex,
	buttons,
	viewportWidth,
	scrollWidth,
	paddingStart = 0,
	paddingEnd = 0,
}: SidebarViewScrollLayout): number {
	const activeButton = buttons[activeIndex]
	if (!activeButton || viewportWidth <= 0) return 0

	const previousButton = buttons[activeIndex - 1]
	const nextButton = buttons[activeIndex + 1]
	const clusterLeft = previousButton?.left ?? activeButton.left
	const clusterRight = nextButton
		? nextButton.left + nextButton.width
		: activeButton.left + activeButton.width
	const contentViewportWidth = Math.max(0, viewportWidth - paddingStart - paddingEnd)
	const clusterWidth = clusterRight - clusterLeft
	const targetCenter =
		clusterWidth <= contentViewportWidth
			? clusterLeft + clusterWidth / 2
			: activeButton.left + activeButton.width / 2
	const viewportCenter = paddingStart + contentViewportWidth / 2
	const maximumScrollLeft = Math.max(0, scrollWidth - viewportWidth)

	return Math.min(maximumScrollLeft, Math.max(0, targetCenter - viewportCenter))
}

export function getSidebarViewLabelMaxWidth(width: number): number {
	if (width <= 0) return 120
	return Math.round(Math.min(120, Math.max(48, width * 0.36 - 12)))
}

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
