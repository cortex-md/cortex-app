import type { CommandEntry, CommandHotkeyScope } from "@cortex/commands"

export type ModifierKey = "mod" | "shift" | "alt" | "ctrl" | "meta"
export type HotkeyScope = CommandHotkeyScope

export interface HotkeyBinding extends Pick<CommandEntry, "id" | "label" | "category"> {
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
