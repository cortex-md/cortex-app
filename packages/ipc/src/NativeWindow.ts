import type { NativeWindow as INativeWindow, OpenSettingsWindowOptions } from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"
import { WebviewWindow } from "@tauri-apps/api/webviewWindow"
import { getCurrentWindow } from "@tauri-apps/api/window"

interface SettingsRoutePayload extends OpenSettingsWindowOptions {}

function buildSettingsUrl(options: OpenSettingsWindowOptions = {}): string {
	const params = new URLSearchParams()
	params.set("window", "settings")
	if (options.section) params.set("section", options.section)
	if (options.vaultPath) params.set("vaultPath", options.vaultPath)
	if (options.vaultName) params.set("vaultName", options.vaultName)
	return `index.html?${params.toString()}`
}

export class NativeWindow implements INativeWindow {
	async openSettings(options: OpenSettingsWindowOptions = {}): Promise<void> {
		const existing = await WebviewWindow.getByLabel("settings")
		if (existing) {
			await Promise.all([
				existing.emit<SettingsRoutePayload>("settings-route", options),
				existing.unminimize().catch(() => {}),
				existing.show().catch(() => {}),
			]).then(() => existing.setFocus().catch(() => {}))
			return
		}

		const settingsWindow = new WebviewWindow("settings", {
			url: buildSettingsUrl(options),
			title: "Settings",
			width: 1000,
			height: 700,
			minWidth: 760,
			minHeight: 520,
			center: true,
			decorations: true,
			shadow: true,
			resizable: true,
			focus: true,
			visible: true,
		})

		await new Promise<void>((resolve, reject) => {
			settingsWindow.once("tauri://created", () => resolve())
			settingsWindow.once<string>("tauri://error", (event) => reject(new Error(event.payload)))
		})
	}

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
