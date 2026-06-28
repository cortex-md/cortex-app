import { CommandRegistry } from "./CommandRegistry"
import type { CommandEntry, CommandExecutionContext } from "./types"

export { CommandRegistry } from "./CommandRegistry"
export type {
	CommandEntry,
	CommandExecutionContext,
	CommandHotkey,
	CommandHotkeyScope,
	CommandIcon,
	CommandIconRenderer,
	CommandRegistrySnapshot,
	CommandRegistrySubscriber,
	VimCommandChoice,
} from "./types"
export {
	buildVimCommandChoices,
	getPrimaryVimCommandName,
	isReservedVimCommandName,
	normalizeVimCommandName,
} from "./vimNames"

export const commandRegistry = new CommandRegistry()

export function registerCommand(command: CommandEntry): () => void {
	return commandRegistry.register(command)
}

export function getCommands(): CommandEntry[] {
	return commandRegistry.getAll()
}

export function getCommandSnapshot() {
	return commandRegistry.getSnapshot()
}

export function executeCommand(
	id: string,
	context: CommandExecutionContext = { source: "api" },
): boolean {
	return commandRegistry.execute(id, context)
}
