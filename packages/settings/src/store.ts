import { create } from "zustand"
import { DEFAULT_APP_SETTINGS } from "./defaults"
import { getSettingsManager } from "./SettingsManager"
import type { AppSettings } from "./types"
import { AppSettingsSchema } from "./types"

let unsubscribeSettingsManager: (() => void) | null = null

interface SettingsState {
	settings: AppSettings
	isLoading: boolean
	error: string | null
	loadGlobalSettings: () => Promise<void>
	loadSettings: (vaultPath: string) => Promise<void>
	updateSetting: <K extends keyof AppSettings>(
		section: K,
		key: keyof AppSettings[K],
		value: unknown,
	) => Promise<void>
	getSetting: <K extends keyof AppSettings>(section: K, key: keyof AppSettings[K]) => unknown
	getSectionSettings: <K extends keyof AppSettings>(section: K) => AppSettings[K]
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
	settings: AppSettingsSchema.parse(DEFAULT_APP_SETTINGS),
	isLoading: false,
	error: null,

	loadGlobalSettings: async () => {
		try {
			const manager = getSettingsManager()
			await manager.loadGlobalSettings()
			set({ settings: manager.getAll() })
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to load global settings",
			})
		}
	},

	loadSettings: async (vaultPath: string) => {
		set({ isLoading: true, error: null })
		try {
			const manager = getSettingsManager()
			await manager.loadFromVault(vaultPath)

			unsubscribeSettingsManager?.()
			unsubscribeSettingsManager = manager.subscribe((event) => {
				set((state) => ({
					settings: {
						...state.settings,
						[event.section]: {
							...state.settings[event.section],
							[event.key]: event.newValue,
						},
					},
				}))
			})

			set({ settings: manager.getAll(), isLoading: false })
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to load settings",
				isLoading: false,
			})
		}
	},

	updateSetting: async (section, key, value) => {
		const manager = getSettingsManager()
		await manager.set(section, key, value)
		set({ settings: manager.getAll() })
	},

	getSetting: (section, key) => {
		const manager = getSettingsManager()
		return manager.get(section, key)
	},

	getSectionSettings: (section) => {
		return get().settings[section]
	},
}))
