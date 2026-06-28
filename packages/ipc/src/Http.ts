import type { Http as IHttp } from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"

export class Http implements IHttp {
	async fetch(url: string, options?: RequestInit): Promise<Response> {
		return window.fetch(url, options)
	}

	async download(url: string): Promise<string> {
		return await invoke<string>("download_text", { url })
	}
}
