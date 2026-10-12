import { DEFAULT_APPEARANCE_SETTINGS } from "./defaults"
import type { AppearanceSettings } from "./types"

export const FONT_SIZE_LIMITS = { min: 10, max: 24 } as const

export type FontScaleStep = -1 | 0 | 1

type FontSizes = Pick<AppearanceSettings, "uiFontSize" | "editorFontSize">

function clampFontSize(size: number): number {
	return Math.min(FONT_SIZE_LIMITS.max, Math.max(FONT_SIZE_LIMITS.min, size))
}

export function stepFontSizes(current: FontSizes, step: FontScaleStep): FontSizes {
	if (step === 0) {
		return {
			uiFontSize: DEFAULT_APPEARANCE_SETTINGS.uiFontSize,
			editorFontSize: DEFAULT_APPEARANCE_SETTINGS.editorFontSize,
		}
	}
	return {
		uiFontSize: clampFontSize(current.uiFontSize + step),
		editorFontSize: clampFontSize(current.editorFontSize + step),
	}
}
