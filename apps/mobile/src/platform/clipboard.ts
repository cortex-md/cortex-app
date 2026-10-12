import type { Platform } from "@cortex/platform"
import * as ExpoClipboard from "expo-clipboard"

export const clipboardApi = {
	readText: () => ExpoClipboard.getStringAsync(),
	writeText: async (text) => {
		await ExpoClipboard.setStringAsync(text)
	},
} satisfies Platform["clipboard"]
