import type { AppearanceSettings } from "@cortex/settings"
import type { ThemeFamily } from "@cortex/theme"

import type { SettingsOption } from "@/features/settings/settingsControlTypes"

type ColorSchemeSetting = AppearanceSettings["colorscheme"]

export const COLOR_SCHEME_LABELS: Record<ColorSchemeSetting, string> = {
	dark: "Dark",
	light: "Light",
	system: "System",
}

export const COLOR_SCHEME_OPTIONS: SettingsOption<ColorSchemeSetting>[] = [
	{ label: COLOR_SCHEME_LABELS.light, value: "light" },
	{ label: COLOR_SCHEME_LABELS.dark, value: "dark" },
	{ label: COLOR_SCHEME_LABELS.system, value: "system" },
]

export const DEFAULT_THEME_FAMILY = "default"

export function themeFamilyOptions(families: readonly ThemeFamily[]): SettingsOption<string>[] {
	return families.map((family) => ({ label: family.displayName, value: family.name }))
}

export function selectedThemeFamily(families: readonly ThemeFamily[], theme: string): string {
	return families.some((family) => family.name === theme) ? theme : DEFAULT_THEME_FAMILY
}
