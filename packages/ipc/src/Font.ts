import type { FontInfo, Font as IFont } from "@cortex/platform"
import { invoke } from "./bridge"

export class Font implements IFont {
	async listSystemFonts(): Promise<FontInfo[]> {
		return await invoke<FontInfo[]>("list_system_fonts")
	}
}
