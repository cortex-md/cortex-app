import {
	type CommandEntry,
	type CommandExecutionContext,
	executeCommand,
	registerCommand,
} from "@cortex/commands"
import type { MarkdownCommandExecutor } from "@cortex/editor/keymap"
import {
	createMarkdownFormatBindings,
	createMarkdownFormatCommandEntries,
	createMarkdownSlashCommandItems,
	markdownFormatCommandDefinitions,
} from "@cortex/editor/markdown-format-commands"
import type { EditorCommand, EditorRuntimeView } from "@cortex/editor/types"

let activeEditorView: EditorRuntimeView | null = null
let unregisterCommands: (() => void)[] | null = null

export const mobileEditorFormatBindings = createMarkdownFormatBindings()
export const mobileEditorSlashCommandItems = createMarkdownSlashCommandItems(
	markdownFormatCommandDefinitions,
)

export function registerMobileEditorCommands(): void {
	if (unregisterCommands) return
	unregisterCommands = createMarkdownFormatCommandEntries((command: EditorCommand) => {
		if (!activeEditorView) return
		command(activeEditorView)
	}).map((command: CommandEntry) => registerCommand(command))
}

export function setMobileEditorCommandView(view: EditorRuntimeView | null): void {
	activeEditorView = view
}

export function runMobileEditorCommand(
	commandId: string,
	view: EditorRuntimeView,
	source: CommandExecutionContext["source"] = "api",
): boolean {
	setMobileEditorCommandView(view)
	return executeCommand(commandId, { source })
}

export const executeMobileEditorMarkdownCommand: MarkdownCommandExecutor = (commandId, view) =>
	runMobileEditorCommand(commandId, view, "hotkey")
