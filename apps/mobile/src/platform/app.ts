import type { Platform } from "@cortex/platform"
import { normalizePath } from "@cortex/platform/utils"
import Constants from "expo-constants"
import * as Linking from "expo-linking"
import * as WebBrowser from "expo-web-browser"

import { isMobileVaultLogicalPath } from "./mobile-vault-paths"
import { getKnownActualUri } from "./vaultRoots"

export function getCurrentAppVersion(): Promise<string> {
	return Promise.resolve(Constants.expoConfig?.version ?? "0.0.0")
}

function resolveFileAssetUrl(path: string): string {
	const actualUri = getKnownActualUri(normalizePath(path))
	if (actualUri) return actualUri

	if (/^(asset|content|data|file|https?):/u.test(path)) {
		return path
	}

	return path.startsWith("/") && !isMobileVaultLogicalPath(path) ? `file://${path}` : path
}

export const appApi = {
	getCurrentAppVersion,
	onDeepLinkOpen: (listener) => {
		const subscription = Linking.addEventListener("url", (event) => listener([event.url]))

		void Linking.getInitialURL().then((url) => {
			if (url) {
				listener([url])
			}
		})

		return () => subscription.remove()
	},
	openExternalUrl: async (url) => {
		if (await Linking.canOpenURL(url)) {
			await Linking.openURL(url)
			return
		}

		await WebBrowser.openBrowserAsync(url)
	},
	resolveFileAssetUrl,
	onNativeEvent: () => () => {},
} satisfies Platform["app"]
