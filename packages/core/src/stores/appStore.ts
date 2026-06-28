import { getPlatform } from "@cortex/platform"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import {
	readFirstRunOnboardingSeen,
	writeFirstRunOnboardingSeen,
} from "../onboarding/appOnboarding"

export interface AppState {
	version: string | null
	firstRunOnboardingSeen: boolean | null

	loadAppInfo: () => Promise<void>
	loadFirstRunOnboarding: () => Promise<void>
	markFirstRunOnboardingSeen: () => Promise<void>
}

export const useAppStore = create<AppState>()(
	devtools(
		immer((set) => ({
			version: null,
			firstRunOnboardingSeen: null,

			loadAppInfo: async () => {
				const version = await getPlatform().app.getCurrentAppVersion()
				set((state) => {
					state.version = version
				})
			},

			loadFirstRunOnboarding: async () => {
				const firstRunOnboardingSeen = await readFirstRunOnboardingSeen()
				set((state) => {
					state.firstRunOnboardingSeen = firstRunOnboardingSeen
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
		})),
		{ name: "appStore" },
	),
)
