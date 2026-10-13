import type { AppearanceSettings } from "@cortex/settings"

import type { SettingsOption } from "@/features/settings/settingsControlTypes"

export type SchemeOption = "paper" | "ink" | "system"

export const SCHEME_LABELS: Record<SchemeOption, string> = {
	ink: "Ink",
	paper: "Paper",
	system: "System",
}

export const SCHEME_OPTIONS: SettingsOption<SchemeOption>[] = [
	{ label: SCHEME_LABELS.paper, value: "paper" },
	{ label: SCHEME_LABELS.ink, value: "ink" },
	{ label: SCHEME_LABELS.system, value: "system" },
]

export const schemeToSetting: Record<SchemeOption, AppearanceSettings["colorscheme"]> = {
	ink: "dark",
	paper: "light",
	system: "system",
}

export const settingToScheme: Record<AppearanceSettings["colorscheme"], SchemeOption> = {
	dark: "ink",
	light: "paper",
	system: "system",
}
