import { inkTheme, paperTheme, type Theme } from "@cortex/theme"
import { Color } from "expo-router"
import { type ColorSchemeName, type ColorValue, Platform } from "react-native"

export type MobileColorScheme = "light" | "dark"

function createStaticColors({ tokens: { semantic, status } }: Theme) {
	return {
		background: semantic.bg.primary,
		groupedBackground: semantic.bg.secondary,
		secondaryBackground: semantic.bg.elevated,
		label: semantic.text.primary,
		secondaryLabel: semantic.text.secondary,
		mutedLabel: semantic.text.muted,
		destructive: status.error,
		separator: semantic.border.default,
		tint: semantic.accent.default,
	}
}

type MobileStaticColors = ReturnType<typeof createStaticColors>

const themeColors: Record<MobileColorScheme, MobileStaticColors> = {
	light: createStaticColors(paperTheme),
	dark: createStaticColors(inkTheme),
}

function platformColor(ios: ColorValue, android: ColorValue, fallback: string): ColorValue {
	return Platform.select({
		android,
		default: fallback,
		ios,
	})!
}

function createNativeColors(fallback: MobileStaticColors) {
	return {
		background: platformColor(
			Color.ios.systemBackground,
			Color.android.dynamic.surface,
			fallback.background,
		),
		groupedBackground: platformColor(
			Color.ios.systemGroupedBackground,
			Color.android.dynamic.surfaceContainerLowest,
			fallback.groupedBackground,
		),
		label: platformColor(Color.ios.label, Color.android.dynamic.onSurface, fallback.label),
		destructive: platformColor(
			Color.ios.systemRed,
			Color.android.dynamic.error,
			fallback.destructive,
		),
		secondaryLabel: platformColor(
			Color.ios.secondaryLabel,
			Color.android.dynamic.onSurfaceVariant,
			fallback.secondaryLabel,
		),
		secondaryBackground: platformColor(
			Color.ios.secondarySystemBackground,
			Color.android.dynamic.surfaceContainer,
			fallback.secondaryBackground,
		),
		separator: platformColor(
			Color.ios.separator,
			Color.android.dynamic.outlineVariant,
			fallback.separator,
		),
		tint: platformColor(Color.ios.systemBlue, Color.android.dynamic.primary, fallback.tint),
	}
}

export const mobileColors = {
	light: createNativeColors(themeColors.light),
	dark: createNativeColors(themeColors.dark),
}

export const mobileStaticColors = themeColors

export type MobileColors = (typeof mobileColors)[MobileColorScheme]

export const mobileIconColors = {
	light: { secondary: themeColors.light.mutedLabel, tint: themeColors.light.tint },
	dark: { secondary: themeColors.dark.mutedLabel, tint: themeColors.dark.tint },
}

export type MobileIconColors = (typeof mobileIconColors)[MobileColorScheme]

export function getMobileColorScheme(colorScheme: ColorSchemeName): MobileColorScheme {
	return colorScheme === "dark" ? "dark" : "light"
}
