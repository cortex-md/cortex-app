import type { NativeStackNavigationOptions } from "expo-router"
import { useMemo } from "react"
import { Platform } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

export function useStackScreenOptions(): NativeStackNavigationOptions {
	const { colors } = useMobileColors()
	return useMemo(
		() => ({
			contentStyle: { backgroundColor: colors.groupedBackground },
			headerBackButtonDisplayMode: "minimal",
			headerLargeStyle: { backgroundColor: colors.groupedBackground },
			headerLargeTitleShadowVisible: false,
			headerLargeTitleStyle: { color: colors.label },
			headerShadowVisible: false,
			headerStyle: { backgroundColor: colors.groupedBackground },
			headerTintColor: colors.tint,
			headerTitleStyle: { color: colors.label },
			headerTransparent: Platform.OS === "ios",
		}),
		[colors],
	)
}
