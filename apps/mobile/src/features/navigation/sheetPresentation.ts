import type { NativeStackNavigationOptions } from "expo-router"
import { Platform } from "react-native"

type Detent = "medium" | "large" | "fitToContents"

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
		headerShown: false,
		presentation: "formSheet",
		sheetAllowedDetents: allowedDetents,
		sheetCornerRadius: Platform.OS === "android" ? 28 : undefined,
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
		return { headerShown: false, presentation: "fullScreenModal", ...extra }
	}
	return formSheetOptions(detent, extra)
}

export function fullScreenFormOptions(
	extra?: NativeStackNavigationOptions,
): NativeStackNavigationOptions {
	return { headerShown: false, presentation: "fullScreenModal", ...extra }
}
