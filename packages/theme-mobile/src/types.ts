export interface ExtractThemeTokenMapOptions {
	theme: string
	colorScheme: "light" | "dark"
	selector?: string
	baseTokens?: Record<string, string>
}

export interface ThemeTokenMap {
	theme: string
	colorScheme: "light" | "dark"
	tokens: Record<string, string>
}
