import type { DeepLinkOpenListener, App as IApp } from "@cortex/platform"
import { getVersion } from "@tauri-apps/api/app"
import { convertFileSrc } from "@tauri-apps/api/core"
import { onOpenUrl } from "@tauri-apps/plugin-deep-link"
import { openUrl } from "@tauri-apps/plugin-opener"

export class App implements IApp {
	async getCurrentAppVersion(): Promise<string> {
		return await getVersion()
	}

	async openExternalUrl(url: string): Promise<void> {
		await openUrl(url)
	}

	resolveFileAssetUrl(path: string): string {
		return convertFileSrc(path)
	}

	async onDeepLinkOpen(listener: DeepLinkOpenListener): Promise<() => void> {
		return await onOpenUrl((urls) => {
			listener([...urls])
		})
	}
}
