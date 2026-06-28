import { Color } from "expo-router"
import { Platform, type ColorSchemeName, type ColorValue } from "react-native"

export type MobileColorScheme = "light" | "dark"

function platformColor(ios: ColorValue, android: ColorValue, fallback: string): ColorValue {
	return Platform.select({
		android,
		default: fallback,
		ios,
	})!
}

export const mobileColors = {
	light: {
		background: platformColor(Color.ios.systemBackground, Color.android.dynamic.surface, "#ffffff"),
		groupedBackground: platformColor(
			Color.ios.systemGroupedBackground,
			Color.android.dynamic.surfaceContainerLowest,
			"#f2f2f7",
		),
		label: platformColor(Color.ios.label, Color.android.dynamic.onSurface, "#111111"),
		destructive: platformColor(Color.ios.systemRed, Color.android.dynamic.error, "#ff3b30"),
		secondaryLabel: platformColor(
			Color.ios.secondaryLabel,
			Color.android.dynamic.onSurfaceVariant,
			"#6b7280",
		),
		secondaryBackground: platformColor(
			Color.ios.secondarySystemBackground,
			Color.android.dynamic.surfaceContainer,
			"#f8fafc",
		),
		separator: platformColor(Color.ios.separator, Color.android.dynamic.outlineVariant, "#d1d5db"),
		tint: platformColor(Color.ios.systemBlue, Color.android.dynamic.primary, "#007aff"),
	},
	dark: {
		background: platformColor(Color.ios.systemBackground, Color.android.dynamic.surface, "#000000"),
		groupedBackground: platformColor(
			Color.ios.systemGroupedBackground,
			Color.android.dynamic.surfaceContainerLowest,
			"#111113",
		),
		label: platformColor(Color.ios.label, Color.android.dynamic.onSurface, "#f5f5f7"),
		destructive: platformColor(Color.ios.systemRed, Color.android.dynamic.error, "#ff453a"),
		secondaryLabel: platformColor(
			Color.ios.secondaryLabel,
			Color.android.dynamic.onSurfaceVariant,
			"#a1a1aa",
		),
		secondaryBackground: platformColor(
			Color.ios.secondarySystemBackground,
			Color.android.dynamic.surfaceContainer,
			"#1c1c1e",
		),
		separator: platformColor(Color.ios.separator, Color.android.dynamic.outlineVariant, "#38383a"),
		tint: platformColor(Color.ios.systemBlue, Color.android.dynamic.primary, "#0a84ff"),
	},
} as const

export const mobileStaticColors = {
	light: {
		background: "#ffffff",
		groupedBackground: "#f2f2f7",
		secondaryBackground: "#f8fafc",
	},
	dark: {
		background: "#000000",
		groupedBackground: "#111113",
		secondaryBackground: "#1c1c1e",
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
