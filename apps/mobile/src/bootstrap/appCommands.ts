import { registerCommands } from "@cortex/commands"
import { createFileCommandEntries, useWorkspaceStore } from "@cortex/core"
import { router } from "expo-router"

export function openMobileNote(filePath: string): void {
	useWorkspaceStore.getState().openTab(filePath, { reuseActive: true })
	router.push({ params: { filePath }, pathname: "/(notes)/note" as never })
}

export function registerMobileAppCommands(): () => void {
	return registerCommands(createFileCommandEntries({ openFile: openMobileNote }))
}
