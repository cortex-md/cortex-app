export interface NativeMenuCommand {
	id: string
	label: string
	category: string
	keys: string | null
	scope: "global" | "editor" | "file-explorer"
}

export interface NativeMenuState {
	commands: NativeMenuCommand[]
	checked: Record<string, boolean>
	enabled: Record<string, boolean>
}

export interface NativeMenu {
	setState(state: NativeMenuState): Promise<void>
}
