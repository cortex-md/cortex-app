import type {
	AppUpdateCheckOptions,
	AppUpdateInstallEvent,
	AppUpdateStatus,
	AppUpdates as AppUpdatesInterface,
} from "@cortex/platform"
import { Channel, invoke } from "@tauri-apps/api/core"

export class AppUpdates implements AppUpdatesInterface {
	async getStatus(): Promise<AppUpdateStatus> {
		return await invoke<AppUpdateStatus>("app_update_status")
	}

	async checkForUpdate(options: AppUpdateCheckOptions): Promise<AppUpdateStatus> {
		return await invoke<AppUpdateStatus>("app_update_check", { source: options.source })
	}

	async installUpdate(onEvent?: (event: AppUpdateInstallEvent) => void): Promise<AppUpdateStatus> {
		const channel = new Channel<AppUpdateInstallEvent>()
		channel.onmessage = (event) => {
			onEvent?.(event)
		}
		return await invoke<AppUpdateStatus>("app_update_install", { onEvent: channel })
	}

	async fetchChangelog(version: string): Promise<string | null> {
		return await invoke<string | null>("app_update_fetch_changelog", { version })
	}
}
