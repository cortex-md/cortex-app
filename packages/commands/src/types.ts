export type CommandHotkeyScope = "global" | "editor" | "file-explorer"

export interface CommandHotkey {
	defaultKeys: string
	scope: CommandHotkeyScope
	enabled?: boolean
}

export interface CommandExecutionContext {
	source: "palette" | "hotkey" | "vim" | "slash" | "api" | "menu" | "test"
	input?: string
	vimName?: string
	payload?: unknown
}

export type CommandIconRenderer = (props: { className?: string }) => unknown
export type CommandIcon = string | CommandIconRenderer

export interface CommandEntry {
	id: string
	label: string
	category: string
	aliases?: string[]
	icon?: CommandIcon
	shortcut?: string
	hotkey?: CommandHotkey
	execute: (context: CommandExecutionContext) => void | Promise<void>
}

export interface VimCommandChoice {
	name: string
	commandId: string
	label: string
	category: string
	isPrimary: boolean
}

export type CommandRegistrySubscriber = () => void

export interface CommandRegistrySnapshot {
	version: number
	commands: CommandEntry[]
}
