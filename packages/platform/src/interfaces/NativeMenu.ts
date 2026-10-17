export interface NativeMenuCommand {
	id: string
	label: string
	category: string
	keys: string | null
	scope: "global" | "editor" | "file-explorer"
}

export interface NativeMenuItemStates {
	checked: Record<string, boolean>
	enabled: Record<string, boolean>
}

export interface NativeMenuState extends NativeMenuItemStates {
	commands: NativeMenuCommand[]
}

export interface NativeMenu {
	setCommands(commands: NativeMenuCommand[]): Promise<void>
	setItemStates(states: NativeMenuItemStates): Promise<void>
}
