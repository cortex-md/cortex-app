import { getPlatform } from "@cortex/platform"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import {
	readAppOnboardingState,
	writeFirstRunOnboardingSeen,
	writeWorkspaceModeChosen,
} from "../onboarding/appOnboarding"

export interface AppState {
	version: string | null
	firstRunOnboardingSeen: boolean | null
	workspaceModeChosen: boolean | null

	loadAppInfo: () => Promise<void>
	loadFirstRunOnboarding: () => Promise<void>
	markFirstRunOnboardingSeen: () => Promise<void>
	markWorkspaceModeChosen: () => Promise<void>
}

export const useAppStore = create<AppState>()(
	devtools(
		immer((set) => ({
			version: null,
			firstRunOnboardingSeen: null,
			workspaceModeChosen: null,

			loadAppInfo: async () => {
				const version = await getPlatform().app.getCurrentAppVersion()
				set((state) => {
					state.version = version
				})
			},

			loadFirstRunOnboarding: async () => {
				const { firstRunOnboardingSeen, workspaceModeChosen } = await readAppOnboardingState()
				set((state) => {
					state.firstRunOnboardingSeen = firstRunOnboardingSeen
					state.workspaceModeChosen = workspaceModeChosen
				})
			},

			markFirstRunOnboardingSeen: async () => {
				try {
					await writeFirstRunOnboardingSeen()
				} catch (error) {
					console.error("[First-run onboarding marker write failed]", { error })
				}
				set((state) => {
					state.firstRunOnboardingSeen = true
				})
			},

			markWorkspaceModeChosen: async () => {
				set((state) => {
					state.workspaceModeChosen = true
				})
				try {
					await writeWorkspaceModeChosen()
				} catch (error) {
					console.error("[Workspace mode onboarding marker write failed]", { error })
				}
			},
		})),
		{ name: "appStore" },
	),
)
