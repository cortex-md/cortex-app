import { registerCommands } from "@cortex/commands"
import { createFileCommandEntries } from "@cortex/core"

import { openNote } from "@/features/navigation/routes"

export function openMobileNote(filePath: string): void {
	openNote(filePath)
}

export function registerMobileAppCommands(): () => void {
	return registerCommands(createFileCommandEntries({ openFile: openMobileNote }))
}
