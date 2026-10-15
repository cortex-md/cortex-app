import { commandRegistry } from "@cortex/commands"
import { useHotkeysStore } from "@cortex/commands/hotkeys"

let initialized = false

function syncCommandHotkeys(): void {
	useHotkeysStore.getState().syncCommands(commandRegistry.getAll())
}

export function initializeCommandHotkeyBridge(): void {
	if (initialized) return
	initialized = true
	commandRegistry.subscribe(syncCommandHotkeys)
	syncCommandHotkeys()
}
