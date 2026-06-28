import type { FontInfo, Font as IFont } from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"

export class Font implements IFont {
	async listSystemFonts(): Promise<FontInfo[]> {
		return await invoke<FontInfo[]>("list_system_fonts")
	}
}
