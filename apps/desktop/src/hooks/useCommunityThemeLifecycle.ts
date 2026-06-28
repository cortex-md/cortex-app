import { getPlatform, type VaultMetadata } from "@cortex/platform"
import { useEffect, useState } from "react"
import { applyAppearanceSettings } from "../features/settings/applyAppearance"
import {
	loadCommunityThemes,
	reloadCommunityThemes,
	unloadCommunityThemes,
} from "../features/themes/communityThemeLoader"
import { reportAppError } from "../utils/reportAppError"

type AppearanceSettings = Parameters<typeof applyAppearanceSettings>[0]

export function useCommunityThemeLifecycle(
	vault: VaultMetadata | null,
	appearance: AppearanceSettings,
): void {
	const themesDirectory = vault ? `${vault.path}/.cortex/themes` : null
	const [loadedThemesDirectory, setLoadedThemesDirectory] = useState<string | null>(null)
	const themesLoaded = loadedThemesDirectory === themesDirectory

	useEffect(() => {
		if (!themesDirectory) return
		let cancelled = false
		let stopThemesWatcher: (() => void) | null = null
		let themeReloadTimer: number | null = null
		const initializeThemes = async () => {
			await getPlatform().fs.createDir(themesDirectory)
			await loadCommunityThemes(themesDirectory)
			if (!cancelled) setLoadedThemesDirectory(themesDirectory)
			if (cancelled) return
			const stopWatching = await getPlatform().fs.startWatching(
				themesDirectory,
				() => {
					if (themeReloadTimer) window.clearTimeout(themeReloadTimer)
					themeReloadTimer = window.setTimeout(() => {
						setLoadedThemesDirectory(null)
						reloadCommunityThemes(themesDirectory)
							.then(() => {
								if (!cancelled) setLoadedThemesDirectory(themesDirectory)
							})
							.catch((error) => {
								void reportAppError({
									operation: "reload-community-themes",
									source: "theme-lifecycle",
									cause: error,
								})
							})
					}, 300)
				},
				{ includeHidden: true, followSymlinks: true },
			)
			if (cancelled) {
				stopWatching()
				return
			}
			stopThemesWatcher = stopWatching
		}
		initializeThemes().catch((error) => {
			if (!cancelled) setLoadedThemesDirectory(null)
			void reportAppError({
				operation: "initialize-community-themes",
				source: "theme-lifecycle",
				cause: error,
			})
		})
		return () => {
			cancelled = true
			if (themeReloadTimer) window.clearTimeout(themeReloadTimer)
			stopThemesWatcher?.()
			unloadCommunityThemes()
		}
	}, [themesDirectory])

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
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
		const handleSystemThemeChange = () => applyAppearance()
		mediaQuery.addEventListener("change", handleSystemThemeChange)
		return () => mediaQuery.removeEventListener("change", handleSystemThemeChange)
	}, [appearance, themesLoaded, vault])
}
