import type { ThemeAdapter } from "./adapter"
import { inkTheme } from "./themes/ink"
import { paperTheme } from "./themes/paper"
import type { CSSGenerator, Theme, ThemeFamily, ThemeName } from "./types"

const DEFAULT_FAMILY: ThemeFamily = {
	name: "default",
	displayName: "Default",
	darkTheme: "ink",
	lightTheme: "paper",
}

export class ThemeManager {
	private themes: Map<string, Theme> = new Map()
	private families: Map<string, ThemeFamily> = new Map()
	private activeTheme: Theme
	private listeners: Set<(theme: Theme) => void> = new Set()
	private adapter: ThemeAdapter | null
	private cssGenerator: CSSGenerator | null

	constructor(
		initialTheme: ThemeName = "ink",
		adapter: ThemeAdapter | null = null,
		cssGenerator: CSSGenerator | null = null,
	) {
		this.adapter = adapter
		this.cssGenerator = cssGenerator
		this.themes.set("paper", paperTheme)
		this.themes.set("ink", inkTheme)
		this.families.set("default", DEFAULT_FAMILY)
		this.activeTheme = this.themes.get(initialTheme) || inkTheme
	}

	configure(adapter: ThemeAdapter | null, cssGenerator: CSSGenerator | null): void {
		this.adapter = adapter
		this.cssGenerator = cssGenerator
	}

	getTheme(name: ThemeName): Theme {
		return this.themes.get(name) || inkTheme
	}

	getActiveTheme(): Theme {
		return this.activeTheme
	}

	setActiveTheme(name: ThemeName): void {
		const theme = this.themes.get(name)
		if (theme) {
			this.activeTheme = theme
		}
		const effectiveTheme = theme ?? this.activeTheme
		this.adapter?.applyTheme(effectiveTheme.name, effectiveTheme.isDark ? "dark" : "light")
		this.listeners.forEach((listener) => {
			if (theme) listener(theme)
		})
	}

	getAllThemes(): Theme[] {
		return Array.from(this.themes.values())
	}

	getThemeFamilies(): ThemeFamily[] {
		return Array.from(this.families.values())
	}

	resolveTheme(familyName: string, colorscheme: "light" | "dark"): string {
		const family = this.families.get(familyName)
		if (!family) return colorscheme === "dark" ? "ink" : "paper"
		return colorscheme === "dark" ? family.darkTheme : family.lightTheme
	}

	getCSSVariables(themeName?: ThemeName): Record<string, string> {
		if (!this.cssGenerator) return {}
		const theme = themeName ? this.themes.get(themeName) : this.activeTheme
		return theme ? this.cssGenerator.generateCSSVariables(theme) : {}
	}

	injectAllThemes(): void {
		if (!this.cssGenerator) return
		for (const theme of this.themes.values()) {
			const cssString = this.cssGenerator.generateCSSString(theme)
			this.adapter?.injectCSS(cssString, theme.name)
		}
	}

	registerTheme(theme: Theme): void {
		this.themes.set(theme.name, theme)
	}

	registerCommunityFamily(family: ThemeFamily): void {
		this.families.set(family.name, family)

		this.themes.set(family.darkTheme, {
			name: family.darkTheme,
			displayName: `${family.displayName} Dark`,
			isDark: true,
			tokens: inkTheme.tokens,
		})

		this.themes.set(family.lightTheme, {
			name: family.lightTheme,
			displayName: `${family.displayName} Light`,
			isDark: false,
			tokens: paperTheme.tokens,
		})

		for (const listener of this.listeners) listener(this.activeTheme)
	}

	unregisterTheme(familyName: string): void {
		const family = this.families.get(familyName)
		if (!family || familyName === "default") return

		this.themes.delete(family.darkTheme)
		this.themes.delete(family.lightTheme)
		this.families.delete(familyName)

		this.adapter?.removeCSS(family.darkTheme)
		this.adapter?.removeCSS(family.lightTheme)

		if (this.activeTheme.name === family.darkTheme || this.activeTheme.name === family.lightTheme) {
			this.setActiveTheme("ink")
		}
	}

	injectCSS(cssString: string, themeName: string): void {
		this.adapter?.injectCSS(cssString, themeName)
	}

	applyOverrides(overrides: Record<string, string>): void {
		this.adapter?.applyOverrides(overrides)
	}

	clearOverrides(): void {
		this.adapter?.clearOverrides()
	}

	subscribe(listener: (theme: Theme) => void): () => void {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}
}

let instance: ThemeManager

export function getThemeManager(): ThemeManager {
	if (!instance) {
		instance = new ThemeManager()
	}
	return instance
}

export function initThemeManager(
	initialTheme: ThemeName = "ink",
	adapter: ThemeAdapter | null = null,
	cssGenerator: CSSGenerator | null = null,
): ThemeManager {
	if (!instance) {
		instance = new ThemeManager(initialTheme, adapter, cssGenerator)
	} else {
		instance.configure(adapter, cssGenerator)
		if (instance.getActiveTheme().name !== initialTheme) {
			instance.setActiveTheme(initialTheme)
		}
	}
	instance.injectAllThemes()
	const theme = instance.getActiveTheme()
	adapter?.applyTheme(theme.name, theme.isDark ? "dark" : "light")
	return instance
}
