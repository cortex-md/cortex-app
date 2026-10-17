import { DarkTheme, DefaultTheme, type Theme } from "expo-router/react-navigation"

import type { MobileColors } from "@/theme/colors"

export function createNavigationTheme(colors: MobileColors): Theme {
	const base = colors.scheme === "dark" ? DarkTheme : DefaultTheme
	return {
		...base,
		colors: {
			...base.colors,
			background: colors.background,
			border: colors.separator,
			card: colors.background,
			notification: colors.destructive,
			primary: colors.tint,
			text: colors.label,
		},
	}
}
