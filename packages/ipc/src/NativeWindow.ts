import type { NativeWindow as INativeWindow } from "@cortex/platform"
import { invoke } from "./bridge"

export class NativeWindow implements INativeWindow {
	async closeCurrent(): Promise<void> {
		await invoke<void>("window_close_current")
	}

	async focusMain(): Promise<void> {
		await invoke<void>("window_focus_main")
	}

	async restartApp(): Promise<void> {
		await invoke<void>("restart_app")
	}
}
