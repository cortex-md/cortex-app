import type { AppearanceSettings } from "@cortex/settings"
import {
	DEFAULT_ACCENT_COLOR,
	DEFAULT_APPEARANCE_SETTINGS,
	SYSTEM_FONT_FAMILY,
	SYSTEM_FONT_STACK,
} from "@cortex/settings/defaults"
import {
	getThemeManager,
	resolveAccessibleColor,
	resolveAccessibleForeground,
	type ThemeTokens,
} from "@cortex/theme"
import { ensureCommunityThemeCssLoaded } from "../themes/communityThemeLoader"

function buildFontStack(fontFamily: string): string {
	if (fontFamily === SYSTEM_FONT_FAMILY) {
		return SYSTEM_FONT_STACK
	}
	return `"${fontFamily}", ${SYSTEM_FONT_STACK}`
}

function buildAccentOverrides(hex: string): Record<string, string> {
	const activeTheme = getThemeManager().getActiveTheme()
	const tokens = activeTheme.tokens as Partial<ThemeTokens>
	const bgPrimary = tokens.semantic?.bg.primary ?? (activeTheme.isDark ? "#1e1e1e" : "#fbfbfc")
	const bgSecondary = tokens.semantic?.bg.secondary ?? (activeTheme.isDark ? "#282828" : "#f5f5f7")
	const textPrimary = tokens.semantic?.text.primary ?? (activeTheme.isDark ? "#dcdcdc" : "#303342")
	const subtleAmount = activeTheme.isDark ? 16 : 12
	const hoverAmount = activeTheme.isDark ? 24 : 18
	const activeAmount = activeTheme.isDark ? 34 : 26
	const textAmount = activeTheme.isDark ? 72 : 82
	const accentSubtle = `color-mix(in srgb, ${hex} ${subtleAmount}%, ${bgPrimary})`
	const accentText = `color-mix(in srgb, ${hex} ${textAmount}%, ${textPrimary})`
	const textOnAccent = resolveAccessibleForeground(hex)
	const focusColor = resolveAccessibleColor(hex, bgPrimary)

	return {
		"--accent": hex,
		"--accent-border": hex,
		"--accent-hover": `color-mix(in srgb, ${hex} ${hoverAmount}%, ${bgSecondary})`,
		"--accent-active": `color-mix(in srgb, ${hex} ${activeAmount}%, ${bgSecondary})`,
		"--accent-subtle": accentSubtle,
		"--accent-text": accentText,
		"--brand": hex,
		"--brand-border": hex,
		"--brand-hover": `color-mix(in srgb, ${hex} ${hoverAmount}%, ${bgSecondary})`,
		"--brand-active": `color-mix(in srgb, ${hex} ${activeAmount}%, ${bgSecondary})`,
		"--brand-subtle": accentSubtle,
		"--brand-text": accentText,
		"--text-on-accent": textOnAccent,
		"--bg-selected": accentSubtle,
		"--btn-primary-bg": hex,
		"--btn-primary-text": textOnAccent,
		"--primary": hex,
		"--primary-foreground": textOnAccent,
		"--border-focus": focusColor,
		"--ring": focusColor,
		"--tab-accent": hex,
		"--sidebar-primary": hex,
		"--sidebar-primary-foreground": textOnAccent,
		"--sidebar-accent": accentSubtle,
		"--sidebar-accent-foreground": accentText,
		"--sidebar-ring": focusColor,
		"--chart-1": hex,
	}
}

export function buildAppearanceOverrides(appearance: AppearanceSettings): Record<string, string> {
	const overrides: Record<string, string> = {}

	if (appearance.accentColor !== DEFAULT_ACCENT_COLOR) {
		Object.assign(overrides, buildAccentOverrides(appearance.accentColor))
	}

	if (appearance.uiFontFamily !== DEFAULT_APPEARANCE_SETTINGS.uiFontFamily) {
		overrides["--font-ui"] = buildFontStack(appearance.uiFontFamily)
	}
	if (appearance.uiFontSize !== DEFAULT_APPEARANCE_SETTINGS.uiFontSize) {
		overrides["--ui-font-size"] = `${appearance.uiFontSize}px`
	}
	if (appearance.editorFontFamily !== DEFAULT_APPEARANCE_SETTINGS.editorFontFamily) {
		overrides["--font-editor"] = buildFontStack(appearance.editorFontFamily)
	}
	if (appearance.editorFontSize !== DEFAULT_APPEARANCE_SETTINGS.editorFontSize) {
		overrides["--editor-font-size"] = `${appearance.editorFontSize}px`
	}

	return overrides
}

function resolveColorscheme(colorscheme: "light" | "dark" | "system"): "light" | "dark" {
	if (colorscheme === "system") {
		return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
	}
	return colorscheme
}

let appearanceApplySequence = 0

export async function applyAppearanceSettings(appearance: AppearanceSettings): Promise<void> {
	const sequence = ++appearanceApplySequence
	const themeManager = getThemeManager()
	const resolved = resolveColorscheme(appearance.colorscheme)
	const themeName = themeManager.resolveTheme(appearance.theme, resolved)

	await ensureCommunityThemeCssLoaded(themeName)
	if (sequence !== appearanceApplySequence) return

	themeManager.setActiveTheme(themeName)
	themeManager.applyOverrides(buildAppearanceOverrides(appearance))
}
