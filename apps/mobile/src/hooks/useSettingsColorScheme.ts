import { useSettingsStore } from "@cortex/settings"
import { useEffect } from "react"
import { Appearance } from "react-native"

export function useSettingsColorScheme(): void {
	const colorscheme = useSettingsStore((state) => state.settings.appearance.colorscheme)

	useEffect(() => {
		Appearance.setColorScheme?.(colorscheme === "system" ? "unspecified" : colorscheme)
	}, [colorscheme])
}
