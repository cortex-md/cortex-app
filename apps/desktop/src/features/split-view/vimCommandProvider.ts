import { commandRegistry } from "@cortex/commands"
import type { VimCommandProvider } from "@cortex/editor/types"

export const cortexVimCommandProvider: VimCommandProvider = {
	getChoices: () => commandRegistry.getVimChoices(),
	execute: (name, input) => commandRegistry.executeVimCommand(name, input),
	subscribe: (callback) => commandRegistry.subscribe(callback),
}
