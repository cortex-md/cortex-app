import type { NativeStackNavigationOptions } from "expo-router"
import { useMemo } from "react"
import { Platform } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const IS_LIQUID_GLASS = IS_IOS && Number.parseInt(String(Platform.Version), 10) >= 26

export function useStackScreenOptions(): NativeStackNavigationOptions {
	const { colors } = useMobileColors()
	return useMemo<NativeStackNavigationOptions>(() => {
		const shared: NativeStackNavigationOptions = {
			contentStyle: { backgroundColor: colors.groupedBackground },
			headerBackButtonDisplayMode: "minimal",
			headerLargeTitleStyle: { color: colors.label },
			headerShadowVisible: false,
			headerTintColor: colors.tint,
			headerTitleStyle: { color: colors.label },
		}
		if (!IS_IOS) {
			return { ...shared, headerStyle: { backgroundColor: colors.groupedBackground } }
		}
		return {
			...shared,
			headerBlurEffect: IS_LIQUID_GLASS ? undefined : "systemChromeMaterial",
			headerLargeStyle: { backgroundColor: "transparent" },
			headerLargeTitleShadowVisible: false,
			headerTransparent: true,
		}
	}, [colors])
}
