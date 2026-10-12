import type { NativePlatform } from "@cortex/platform"
import { Platform as ReactNativePlatform } from "react-native"

export function getNativePlatform(): NativePlatform {
	switch (ReactNativePlatform.OS) {
		case "ios":
			return "ios"
		case "android":
			return "android"
		case "web":
			return "web"
		case "macos":
			return "macos"
		case "windows":
			return "windows"
		default:
			return "linux"
	}
}
