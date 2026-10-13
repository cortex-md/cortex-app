import { useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"
import { getThemeManager } from "@cortex/theme"

import {
	reloadCommunityThemes,
	subscribeCommunityThemes,
	unloadCommunityThemes,
} from "@/features/themes/communityThemes"

async function resolveActiveThemeName(): Promise<string> {
	const appearance = useSettingsStore.getState().settings.appearance
	const colorScheme =
		appearance.colorscheme === "system"
			? (await getPlatform().appearance.getSnapshot()).colorScheme
			: appearance.colorscheme
	return getThemeManager().resolveTheme(appearance.theme, colorScheme)
}

function syncVaultThemes(vaultPath: string | undefined): void {
	if (vaultPath) void reloadCommunityThemes()
	else unloadCommunityThemes()
}

export function startMobileThemeSync(): () => void {
	let sequence = 0
	const applyTheme = () => {
		const current = ++sequence
		void resolveActiveThemeName().then((themeName) => {
			const themeManager = getThemeManager()
			if (current !== sequence) return
			if (themeManager.getActiveTheme() === themeManager.getTheme(themeName)) return
			themeManager.setActiveTheme(themeName)
		})
	}

	applyTheme()
	const unsubscribeSettings = useSettingsStore.subscribe((state, previousState) => {
		if (state.settings.appearance !== previousState.settings.appearance) applyTheme()
	})
	const unsubscribeAppearance = getPlatform().appearance.subscribe(applyTheme)
	const unsubscribeCommunityThemes = subscribeCommunityThemes(applyTheme)
	let vaultPath = useVaultStore.getState().vault?.path
	syncVaultThemes(vaultPath)
	const unsubscribeVault = useVaultStore.subscribe((state) => {
		if (state.vault?.path === vaultPath) return
		vaultPath = state.vault?.path
		syncVaultThemes(vaultPath)
	})

	return () => {
		sequence++
		unsubscribeSettings()
		unsubscribeAppearance()
		unsubscribeCommunityThemes()
		unsubscribeVault()
	}
}
