export type ModifierKey = "mod" | "shift" | "alt" | "ctrl" | "meta"
export type HotkeyScope = "global" | "editor" | "file-explorer"

export interface HotkeyBinding {
	id: string
	label: string
	category: string
	scope: HotkeyScope
	defaultKeys: string
	keys: string
	enabled: boolean
}

export interface HotkeyOverride {
	keys: string
	enabled?: boolean
}

export type HotkeyOverrides = Record<string, HotkeyOverride>

export interface ParsedHotkey {
	mod: boolean
	shift: boolean
	alt: boolean
	ctrl: boolean
	meta: boolean
	key: string
}
