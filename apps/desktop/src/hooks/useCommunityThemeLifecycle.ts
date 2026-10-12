import { reportAppError } from "@cortex/core"
import { getPlatform, type VaultMetadata } from "@cortex/platform"
import { useEffect, useState } from "react"
import { applyAppearanceSettings } from "../features/settings/applyAppearance"
import {
	loadCommunityThemes,
	reloadCommunityThemes,
	unloadCommunityThemes,
} from "../features/themes/communityThemeLoader"
import { useWatchedDirectory } from "./useWatchedDirectory"

type AppearanceSettings = Parameters<typeof applyAppearanceSettings>[0]

export function useCommunityThemeLifecycle(
	vault: VaultMetadata | null,
	appearance: AppearanceSettings,
): void {
	const themesDirectory = vault ? `${vault.path}/.cortex/themes` : null
	const [loadedThemesDirectory, setLoadedThemesDirectory] = useState<string | null>(null)
	const themesLoaded = loadedThemesDirectory === themesDirectory

	useWatchedDirectory(themesDirectory, {
		load: async (directory, signal) => {
			await loadCommunityThemes(directory)
			if (!signal.aborted) setLoadedThemesDirectory(directory)
		},
		reload: async (directory, signal) => {
			setLoadedThemesDirectory(null)
			await reloadCommunityThemes(directory)
			if (!signal.aborted) setLoadedThemesDirectory(directory)
		},
		unload: unloadCommunityThemes,
		onError: (operation, error) => {
			if (operation === "load") setLoadedThemesDirectory(null)
			void reportAppError({
				operation: operation === "load" ? "initialize-community-themes" : "reload-community-themes",
				source: "theme-lifecycle",
				cause: error,
			})
		},
	})

	useEffect(() => {
		if (!vault || !themesLoaded) return
		const applyAppearance = () => {
			void applyAppearanceSettings(appearance).catch((error) => {
				void reportAppError({
					operation: "apply-appearance-settings",
					source: "theme-lifecycle",
					cause: error,
				})
			})
		}
		applyAppearance()
		if (appearance.colorscheme !== "system") return
		return getPlatform().appearance.subscribe(applyAppearance)
	}, [appearance, themesLoaded, vault])
}
