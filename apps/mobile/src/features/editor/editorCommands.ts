import { type CommandExecutionContext, executeCommand, registerCommands } from "@cortex/commands"
import { createEditorCommandEntries } from "@cortex/editor/editor-command-entries"
import type { FormatBinding, MarkdownCommandExecutor } from "@cortex/editor/keymap"
import {
	createMarkdownFormatBindings,
	createMarkdownFormatCommandEntries,
	createMarkdownSlashCommandItems,
	markdownFormatCommandDefinitions,
	markdownToolbarCommandIds,
	markdownToolbarShortLabels,
} from "@cortex/editor/markdown-format-commands"
import type { EditorCommand, EditorRuntimeView } from "@cortex/editor/types"
import type { HotkeyOverrides } from "@cortex/commands/hotkeys"

import type { EditorCommandSummary } from "@/features/workspace/workspaceProtocol"

let activeEditorView: EditorRuntimeView | null = null
let unregisterCommands: (() => void) | null = null
let registeredSummaries: EditorCommandSummary[] = []

const mobileEditorFormatBindings = createMarkdownFormatBindings()
const formatCommandLabels = new Map<string, string>(
	markdownFormatCommandDefinitions.map((definition) => [definition.id, definition.label]),
)

export const mobileEditorSlashCommandItems = createMarkdownSlashCommandItems(
	markdownFormatCommandDefinitions,
)

export const mobileEditorToolbarItems = markdownToolbarCommandIds.flatMap((id) => {
	const label = formatCommandLabels.get(id)
	return label ? [{ id, label, shortLabel: markdownToolbarShortLabels[id] }] : []
})

export function getMobileEditorFormatBindings(overrides: HotkeyOverrides): FormatBinding[] {
	return mobileEditorFormatBindings.map((binding) => {
		const override = overrides[binding.id]
		if (!override) return binding
		return {
			...binding,
			keys: override.keys ?? binding.keys,
			enabled: override.enabled ?? binding.enabled,
		}
	})
}

export function registerMobileEditorCommands(): void {
	if (unregisterCommands) return
	const runCommand = (command: EditorCommand) => {
		if (activeEditorView) void command(activeEditorView)
	}
	const entries = [
		...createEditorCommandEntries(runCommand),
		...createMarkdownFormatCommandEntries(runCommand),
	]
	registeredSummaries = entries.map((entry) => ({
		id: entry.id,
		label: entry.label,
		category: entry.category,
		aliases: entry.aliases ? [...entry.aliases] : undefined,
	}))
	unregisterCommands = registerCommands(entries)
}

export function listMobileEditorCommands(): EditorCommandSummary[] {
	return registeredSummaries
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
