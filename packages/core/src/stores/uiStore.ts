import { normalizeRecentCommandIds, pushRecentCommandId } from "@cortex/commands"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

export type LeftSidebarView = string

export interface LeftSidebarLayout {
	collapsed: boolean
	width: number
}

export type RightSidebarPanel = "comments" | "outline" | "backlinks"

const RIGHT_SIDEBAR_PANELS: readonly RightSidebarPanel[] = ["comments", "outline", "backlinks"]

export interface RightSidebarLayout {
	collapsed: boolean
	panel: RightSidebarPanel
}

export interface UIState {
	leftSidebarCollapsed: boolean
	leftSidebarWidth: number
	leftSidebarView: LeftSidebarView
	rightSidebarCollapsed: boolean
	rightSidebarPanel: RightSidebarPanel

	toggleLeftSidebar: () => void
	setLeftSidebarCollapsed: (collapsed: boolean) => void
	setLeftSidebarWidth: (width: number) => void
	setLeftSidebarLayout: (layout: Partial<LeftSidebarLayout>) => void
	resetLeftSidebarLayout: () => void
	setLeftSidebarView: (view: LeftSidebarView) => void
	toggleRightSidebar: () => void
	setRightSidebarLayout: (layout: Partial<RightSidebarLayout>) => void

	quickFinderPreview: boolean
	setQuickFinderPreview: (preview: boolean) => void

	recentCommandIds: string[]
	recordRecentCommand: (commandId: string) => void
	setRecentCommandIds: (ids: unknown) => void
}

export const LEFT_SIDEBAR_WIDTH_BOUNDS = {
	min: 228,
	max: 448,
}

const DEFAULT_LEFT_SIDEBAR_LAYOUT: LeftSidebarLayout = {
	collapsed: false,
	width: 292,
}

export function clampLeftSidebarWidth(width: number): number {
	return Math.min(LEFT_SIDEBAR_WIDTH_BOUNDS.max, Math.max(LEFT_SIDEBAR_WIDTH_BOUNDS.min, width))
}

export const useUIStore = create<UIState>()(
	devtools(
		immer((set) => ({
			leftSidebarCollapsed: DEFAULT_LEFT_SIDEBAR_LAYOUT.collapsed,
			leftSidebarWidth: DEFAULT_LEFT_SIDEBAR_LAYOUT.width,
			leftSidebarView: "files",
			rightSidebarCollapsed: true,
			rightSidebarPanel: "outline" as RightSidebarPanel,

			toggleLeftSidebar: () =>
				set((s) => {
					s.leftSidebarCollapsed = !s.leftSidebarCollapsed
				}),

			setLeftSidebarCollapsed: (collapsed) =>
				set((s) => {
					s.leftSidebarCollapsed = collapsed
				}),

			setLeftSidebarWidth: (width) =>
				set((s) => {
					s.leftSidebarWidth = clampLeftSidebarWidth(width)
				}),

			setLeftSidebarLayout: (layout) =>
				set((s) => {
					if (typeof layout.collapsed === "boolean") {
						s.leftSidebarCollapsed = layout.collapsed
					}
					if (typeof layout.width === "number" && Number.isFinite(layout.width)) {
						s.leftSidebarWidth = clampLeftSidebarWidth(layout.width)
					}
				}),

			resetLeftSidebarLayout: () =>
				set((s) => {
					s.leftSidebarCollapsed = DEFAULT_LEFT_SIDEBAR_LAYOUT.collapsed
					s.leftSidebarWidth = DEFAULT_LEFT_SIDEBAR_LAYOUT.width
				}),

			setLeftSidebarView: (view) =>
				set((s) => {
					s.leftSidebarView = view
				}),

			toggleRightSidebar: () =>
				set((s) => {
					s.rightSidebarCollapsed = !s.rightSidebarCollapsed
				}),

			setRightSidebarLayout: (layout) =>
				set((s) => {
					if (typeof layout.collapsed === "boolean") s.rightSidebarCollapsed = layout.collapsed
					if (layout.panel && RIGHT_SIDEBAR_PANELS.includes(layout.panel)) {
						s.rightSidebarPanel = layout.panel
					}
				}),

			quickFinderPreview: false,

			setQuickFinderPreview: (preview) =>
				set((s) => {
					s.quickFinderPreview = preview
				}),

			recentCommandIds: [],

			recordRecentCommand: (commandId) =>
				set((s) => {
					s.recentCommandIds = pushRecentCommandId(s.recentCommandIds, commandId)
				}),

			setRecentCommandIds: (ids) =>
				set((s) => {
					s.recentCommandIds = normalizeRecentCommandIds(ids)
				}),
		})),
		{ name: "uiStore" },
	),
)
