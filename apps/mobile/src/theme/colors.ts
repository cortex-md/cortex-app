import { Color } from "expo-router"
import type { ColorSchemeName } from "react-native"

export type MobileColorScheme = "light" | "dark"

export const mobileColors = {
	light: {
		background: Color.ios.systemBackground,
		groupedBackground: Color.ios.systemGroupedBackground,
		label: Color.ios.label,
		destructive: Color.ios.systemRed,
		secondaryLabel: Color.ios.secondaryLabel,
		secondaryBackground: Color.ios.secondarySystemBackground,
		separator: Color.ios.separator,
		tabBarBackground: Color.ios.systemBackground,
		tabIndicator: Color.android.dynamic.secondaryContainer,
		tabRipple: Color.android.dynamic.primary,
		tint: Color.ios.systemBlue,
	},
	dark: {
		background: Color.ios.systemBackground,
		groupedBackground: Color.ios.systemGroupedBackground,
		label: Color.ios.label,
		destructive: Color.ios.systemRed,
		secondaryLabel: Color.ios.secondaryLabel,
		secondaryBackground: Color.ios.secondarySystemBackground,
		separator: Color.ios.separator,
		tabBarBackground: Color.ios.systemBackground,
		tabIndicator: Color.android.dynamic.secondaryContainer,
		tabRipple: Color.android.dynamic.primary,
		tint: Color.ios.systemBlue,
	},
} as const

export const mobileIconColors = {
	light: {
		secondary: "#8e8e93",
		tint: "#007aff",
	},
	dark: {
		secondary: "#98989d",
		tint: "#0a84ff",
	},
} as const

export function getMobileColorScheme(colorScheme: ColorSchemeName): MobileColorScheme {
	return colorScheme === "dark" ? "dark" : "light"
}
