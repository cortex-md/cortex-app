import {
	type AppearanceSettings,
	SYSTEM_FONT_FAMILY,
	SYSTEM_FONT_STACK,
	useSettingsStore,
} from "@cortex/settings"
import { generateCSSVariables, type Theme } from "@cortex/theme"
import { useMemo } from "react"

import { useActiveTheme } from "@/hooks/useActiveTheme"

function resolveFontFamily(fontFamily: string, themeFontFamily: string): string {
	return fontFamily === SYSTEM_FONT_FAMILY
		? themeFontFamily
		: `"${fontFamily}", ${SYSTEM_FONT_STACK}`
}

export function createEditorThemeTokens(
	theme: Theme,
	appearance: AppearanceSettings,
): Record<string, string> {
	return {
		...generateCSSVariables(theme),
		"--font-ui": resolveFontFamily(appearance.uiFontFamily, theme.tokens.fonts.ui),
		"--font-editor": resolveFontFamily(appearance.editorFontFamily, theme.tokens.fonts.editor),
		"--ui-font-size": `${appearance.uiFontSize}px`,
		"--editor-font-size": `${appearance.editorFontSize}px`,
	}
}

export function useMobileEditorThemeTokens(): Record<string, string> {
	const theme = useActiveTheme()
	const appearance = useSettingsStore((state) => state.settings.appearance)
	return useMemo(() => createEditorThemeTokens(theme, appearance), [theme, appearance])
}
