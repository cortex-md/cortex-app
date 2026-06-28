import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

export type LeftSidebarView = string
export type AuthView = "login" | "register"

export interface LeftSidebarLayout {
	collapsed: boolean
	width: number
}

export interface UIState {
	leftSidebarCollapsed: boolean
	leftSidebarWidth: number
	leftSidebarView: LeftSidebarView
	rightSidebarCollapsed: boolean

	toggleLeftSidebar: () => void
	setLeftSidebarCollapsed: (collapsed: boolean) => void
	setLeftSidebarWidth: (width: number) => void
	setLeftSidebarLayout: (layout: Partial<LeftSidebarLayout>) => void
	resetLeftSidebarLayout: () => void
	setLeftSidebarView: (view: LeftSidebarView) => void
	toggleRightSidebar: () => void

	quickFinderOpen: boolean
	toggleQuickFinder: () => void

	commandPaletteOpen: boolean
	toggleCommandPalette: () => void

	tagPickerOpen: boolean
	toggleTagPicker: () => void

	createFromTemplateOpen: boolean
	openCreateFromTemplate: () => void
	closeCreateFromTemplate: () => void

	settingsOpen: boolean
	settingsInitialSection: string | null
	openSettings: (section?: string) => void
	closeSettings: () => void

	authOpen: boolean
	authInitialView: AuthView
	authReturnTo: string | null
	openAuth: (view?: AuthView, returnTo?: string | null) => void
	closeAuth: () => void
}

export const LEFT_SIDEBAR_WIDTH_BOUNDS = {
	min: 180,
	max: 400,
}

const DEFAULT_LEFT_SIDEBAR_LAYOUT: LeftSidebarLayout = {
	collapsed: false,
	width: 240,
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

			quickFinderOpen: false,

			toggleQuickFinder: () =>
				set((s) => {
					s.quickFinderOpen = !s.quickFinderOpen
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

			settingsOpen: false,
			settingsInitialSection: null,

			openSettings: (section) =>
				set((s) => {
					s.settingsOpen = true
					s.settingsInitialSection = section ?? null
				}),

			closeSettings: () =>
				set((s) => {
					s.settingsOpen = false
					s.settingsInitialSection = null
				}),

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
