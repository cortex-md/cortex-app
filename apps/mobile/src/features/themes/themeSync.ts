import { getPlatform } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"
import { getThemeManager } from "@cortex/theme"

async function resolveActiveThemeName(): Promise<string> {
	const appearance = useSettingsStore.getState().settings.appearance
	const colorScheme =
		appearance.colorscheme === "system"
			? (await getPlatform().appearance.getSnapshot()).colorScheme
			: appearance.colorscheme
	return getThemeManager().resolveTheme(appearance.theme, colorScheme)
}

export function startMobileThemeSync(): () => void {
	let sequence = 0
	const applyTheme = () => {
		const current = ++sequence
		void resolveActiveThemeName().then((themeName) => {
			const themeManager = getThemeManager()
			if (current !== sequence || themeManager.getActiveTheme().name === themeName) return
			themeManager.setActiveTheme(themeName)
		})
	}

	applyTheme()
	const unsubscribeSettings = useSettingsStore.subscribe((state, previousState) => {
		if (state.settings.appearance !== previousState.settings.appearance) applyTheme()
	})
	const unsubscribeAppearance = getPlatform().appearance.subscribe(applyTheme)

	return () => {
		sequence++
		unsubscribeSettings()
		unsubscribeAppearance()
	}
}
