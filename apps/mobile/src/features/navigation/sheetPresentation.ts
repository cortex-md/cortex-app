import type { NativeStackNavigationOptions } from "expo-router"
import { Platform } from "react-native"

type Detent = "medium" | "large" | "fitToContents"

const IS_IOS = Platform.OS === "ios"

const nativeHeaderOptions: NativeStackNavigationOptions = {
	headerShadowVisible: false,
	headerShown: true,
	headerTransparent: IS_IOS,
}

const detentValues: Record<Detent, number[] | "fitToContents"> = {
	fitToContents: "fitToContents",
	large: [1],
	medium: [0.5, 1],
}

export function formSheetOptions(
	detent: Detent | number[],
	extra?: NativeStackNavigationOptions,
): NativeStackNavigationOptions {
	const allowedDetents = Array.isArray(detent) ? detent : detentValues[detent]
	return {
		...nativeHeaderOptions,
		presentation: "formSheet",
		sheetAllowedDetents: allowedDetents,
		sheetCornerRadius: IS_IOS ? undefined : 28,
		sheetGrabberVisible: true,
		sheetInitialDetentIndex: 0,
		...extra,
	}
}

export function fullScreenOrSheetOptions(
	detent: Detent | number[],
	extra?: NativeStackNavigationOptions,
): NativeStackNavigationOptions {
	if (Platform.OS === "android") {
		return { ...nativeHeaderOptions, presentation: "fullScreenModal", ...extra }
	}
	return formSheetOptions(detent, extra)
}

export function fullScreenFormOptions(
	extra?: NativeStackNavigationOptions,
): NativeStackNavigationOptions {
	return { ...nativeHeaderOptions, presentation: "fullScreenModal", ...extra }
}
