import type { ThemeTokenMap } from "@cortex/theme-mobile"

type MobileThemeScheme = "light" | "dark"

export interface MobileThemeAdapter {
	scheme: MobileThemeScheme
	source: string
	tokens: Record<string, string>
}

export function createMobileThemeAdapter(
	tokenMap: ThemeTokenMap | null,
	scheme: MobileThemeScheme,
): MobileThemeAdapter {
	return {
		scheme,
		source: tokenMap ? `${tokenMap.theme} theme tokens` : "Native system appearance",
		tokens: tokenMap?.tokens ?? {},
	}
}
