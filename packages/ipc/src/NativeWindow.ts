import type { NativeWindow as INativeWindow } from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"
import { WebviewWindow } from "@tauri-apps/api/webviewWindow"
import { getCurrentWindow } from "@tauri-apps/api/window"

export class NativeWindow implements INativeWindow {
	async closeCurrent(): Promise<void> {
		await getCurrentWindow().close()
	}

	async focusMain(): Promise<void> {
		const main = await WebviewWindow.getByLabel("main")
		if (!main) return
		await Promise.all([main.unminimize().catch(() => {}), main.show().catch(() => {})]).then(() =>
			main.setFocus().catch(() => {}),
		)
	}

	async restartApp(): Promise<void> {
		await invoke<void>("restart_app")
	}
}
