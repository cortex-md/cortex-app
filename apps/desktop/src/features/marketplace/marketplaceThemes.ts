import { findThemeFamily, type RegistryEntry } from "@cortex/marketplace"
import { useSettingsStore } from "@cortex/settings"
import { getThemeManager } from "@cortex/theme"
import { applyAppearanceSettings } from "../settings/applyAppearance"

export function getMarketplaceThemeName(entry: Pick<RegistryEntry, "id" | "name">): string | null {
	return findThemeFamily(entry, getThemeManager().getThemeFamilies())?.name ?? null
}

export async function applyMarketplaceTheme(
	entry: Pick<RegistryEntry, "id" | "name">,
): Promise<void> {
	const theme = getMarketplaceThemeName(entry)
	if (!theme) return
	const settings = useSettingsStore.getState()
	await settings.updateSetting("appearance", "theme", theme)
	await applyAppearanceSettings({ ...useSettingsStore.getState().settings.appearance, theme })
}
