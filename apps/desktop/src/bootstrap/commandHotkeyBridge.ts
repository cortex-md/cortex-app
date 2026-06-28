import { commandRegistry } from "@cortex/commands"
import { useHotkeysStore } from "@cortex/hotkeys"

let initialized = false
const mirroredCommandIds = new Set<string>()

function syncCommandHotkeys(): void {
	const commands = commandRegistry.getSnapshot().commands
	const activeCommandIds = new Set(commands.map((command) => command.id))
	const hotkeysStore = useHotkeysStore.getState()

	for (const commandId of mirroredCommandIds) {
		if (activeCommandIds.has(commandId)) continue
		hotkeysStore.removeBinding(commandId)
		hotkeysStore.unregisterHandler(commandId)
		mirroredCommandIds.delete(commandId)
	}

	for (const command of commands) {
		const scope = command.hotkey?.scope ?? "global"
		const defaultKeys = command.hotkey?.defaultKeys ?? ""
		hotkeysStore.addBinding({
			id: command.id,
			label: command.label,
			category: command.category,
			scope,
			defaultKeys,
			keys: defaultKeys,
			enabled: command.hotkey?.enabled ?? true,
		})
		if (scope === "global") {
			hotkeysStore.registerHandler(command.id, () => {
				commandRegistry.execute(command.id, { source: "hotkey" })
			})
		} else {
			hotkeysStore.unregisterHandler(command.id)
		}
		mirroredCommandIds.add(command.id)
	}
}

export function initializeCommandHotkeyBridge(): void {
	if (initialized) return
	initialized = true
	commandRegistry.subscribe(syncCommandHotkeys)
	syncCommandHotkeys()
}
