import type { NativeAppearanceSnapshot, Platform } from "@cortex/platform"
import { AccessibilityInfo, Appearance } from "react-native"

import { getNativePlatform } from "./nativePlatform"

async function getAppearanceSnapshot(): Promise<NativeAppearanceSnapshot> {
	const reducedMotion = await AccessibilityInfo.isReduceMotionEnabled()

	return {
		accentColor: null,
		colorScheme: Appearance.getColorScheme() === "dark" ? "dark" : "light",
		highContrast: false,
		platform: getNativePlatform(),
		reducedMotion,
		scrollbarStyle: "overlay",
	}
}

export const appearanceApi = {
	getSnapshot: getAppearanceSnapshot,
	subscribe: (listener) => {
		const subscription = Appearance.addChangeListener(() => {
			void getAppearanceSnapshot().then(listener)
		})

		return () => subscription.remove()
	},
} satisfies Platform["appearance"]
