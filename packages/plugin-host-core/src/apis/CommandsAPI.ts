import {
	type CommandEntry,
	type CommandIcon,
	executeCommand,
	getCommands,
	registerCommand,
} from "@cortex/commands"
import type { Disposable, PluginAPI, PluginCommand } from "@cortex.md/api"
import { requirePluginCapability } from "../manifestCapabilities"

export function createCommandsAPI(pluginId: string): PluginAPI["commands"] {
	return {
		register(command: PluginCommand): Disposable {
			requirePluginCapability(pluginId, "commands")
			const prefixedId = `${pluginId}:${command.id}`
			const category = command.category ?? pluginId
			const unregister = registerCommand({
				id: prefixedId,
				label: command.label,
				category,
				aliases: command.aliases,
				icon: command.icon,
				shortcut: command.shortcut,
				hotkey: command.defaultHotkey
					? {
							defaultKeys: command.defaultHotkey,
							scope: "global",
							enabled: true,
						}
					: undefined,
				execute: () => void command.execute(),
			})

			return {
				dispose() {
					unregister()
				},
			}
		},
		execute(commandId: string): boolean {
			requirePluginCapability(pluginId, "commands")
			return executeCommand(`${pluginId}:${commandId}`, { source: "api" })
		},
	}
}

export type { CommandEntry, CommandIcon }
export { executeCommand, getCommands, registerCommand }
