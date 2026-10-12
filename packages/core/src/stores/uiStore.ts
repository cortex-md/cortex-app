import { getPlatform } from "@cortex/platform"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

export type LeftSidebarView = string
export type AuthView = "login" | "register"

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

export type QuickFinderRequest =
	| { kind: "open" }
	| { kind: "relink-bookmark"; bookmarkPath: string; query: string }

const DEFAULT_QUICK_FINDER_REQUEST: QuickFinderRequest = { kind: "open" }

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

	quickFinderOpen: boolean
	quickFinderRequest: QuickFinderRequest
	quickFinderPreview: boolean
	toggleQuickFinder: () => void
	openQuickFinder: (request?: QuickFinderRequest) => void
	setQuickFinderPreview: (preview: boolean) => void

	commandPaletteOpen: boolean
	toggleCommandPalette: () => void

	tagPickerOpen: boolean
	toggleTagPicker: () => void

	createFromTemplateOpen: boolean
	openCreateFromTemplate: () => void
	closeCreateFromTemplate: () => void

	openSettings: (section?: string, fieldId?: string) => void

	authOpen: boolean
	authInitialView: AuthView
	authReturnTo: string | null
	openAuth: (view?: AuthView, returnTo?: string | null) => void
	closeAuth: () => void
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

			quickFinderOpen: false,
			quickFinderRequest: DEFAULT_QUICK_FINDER_REQUEST,
			quickFinderPreview: false,

			toggleQuickFinder: () =>
				set((s) => {
					s.quickFinderOpen = !s.quickFinderOpen
					s.quickFinderRequest = DEFAULT_QUICK_FINDER_REQUEST
				}),

			openQuickFinder: (request = DEFAULT_QUICK_FINDER_REQUEST) =>
				set((s) => {
					s.quickFinderOpen = true
					s.quickFinderRequest = request
				}),

			setQuickFinderPreview: (preview) =>
				set((s) => {
					s.quickFinderPreview = preview
				}),

			commandPaletteOpen: false,

			toggleCommandPalette: () =>
				set((s) => {
					s.commandPaletteOpen = !s.commandPaletteOpen
				}),

			tagPickerOpen: false,

			toggleTagPicker: () =>
				set((s) => {
					s.tagPickerOpen = !s.tagPickerOpen
				}),

			createFromTemplateOpen: false,

			openCreateFromTemplate: () =>
				set((s) => {
					s.createFromTemplateOpen = true
				}),

			closeCreateFromTemplate: () =>
				set((s) => {
					s.createFromTemplateOpen = false
				}),

			openSettings: (section, fieldId) => {
				void getPlatform().window.openSettings(section ?? null, fieldId ?? null)
			},

			authOpen: false,
			authInitialView: "login" as AuthView,
			authReturnTo: null,

			openAuth: (view = "login", returnTo = null) =>
				set((s) => {
					s.authOpen = true
					s.authInitialView = view
					s.authReturnTo = returnTo
				}),

			closeAuth: () =>
				set((s) => {
					s.authOpen = false
					s.authReturnTo = null
				}),
		})),
		{ name: "uiStore" },
	),
)
