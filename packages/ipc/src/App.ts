import type { DeepLinkOpenListener, App as IApp, NativeEventListener } from "@cortex/platform"
import { invoke, listen } from "./bridge"

export class App implements IApp {
	async getCurrentAppVersion(): Promise<string> {
		return await invoke<string>("app_get_version")
	}

	async openExternalUrl(url: string): Promise<void> {
		await invoke<void>("app_open_external_url", { url })
	}

	resolveFileAssetUrl(path: string): string {
		const normalized = path.replaceAll("\\", "/")
		return `cortex-file://local${normalized.startsWith("/") ? "" : "/"}${encodeURI(normalized)}`
	}

	async onDeepLinkOpen(listener: DeepLinkOpenListener): Promise<() => void> {
		return listen<string[]>("deep-link-open", (urls) => {
			listener(urls)
		})
	}

	async onNativeEvent<T = unknown>(
		name: string,
		listener: NativeEventListener<T>,
	): Promise<() => void> {
		return listen<T>(name, listener)
	}
}
