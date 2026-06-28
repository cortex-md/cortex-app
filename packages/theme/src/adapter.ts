export interface ThemeAdapter {
	applyTheme(themeName: string, colorScheme: "light" | "dark"): void
	injectCSS(cssString: string, themeName: string): void
	removeCSS(themeName: string): void
	applyOverrides(overrides: Record<string, string>): void
	clearOverrides(): void
}
