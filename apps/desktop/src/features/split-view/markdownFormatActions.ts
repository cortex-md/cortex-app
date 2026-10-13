import { type CommandEntry, commandRegistry, getCommands } from "@cortex/commands"
import { markdownToolbarCommandIds } from "@cortex/editor/markdown-format-commands"
import type { SlashCommandItem } from "@cortex/editor/slash-commands"
import { getTemplateSlashItems } from "../templates/insertTemplate"

function toSlashCommandItem(command: CommandEntry): SlashCommandItem {
	return {
		id: command.id,
		label: command.label,
		category: command.category,
		aliases: command.aliases,
	}
}

export function getMarkdownFormatCommands(): Map<string, CommandEntry> {
	return new Map(getCommands().map((command) => [command.id, command]))
}

export function getMarkdownFormatCommandsSnapshot(): string {
	const commands = getMarkdownFormatCommands()
	return markdownToolbarCommandIds
		.map((commandId) => {
			const command = commands.get(commandId)
			return command
				? `${command.id}:${command.label}:${command.hotkey?.defaultKeys ?? ""}`
				: `${commandId}:missing`
		})
		.join("|")
}

export function subscribeMarkdownFormatCommands(listener: () => void): () => void {
	return commandRegistry.subscribe(listener)
}

export function getSlashCommandItems(): SlashCommandItem[] {
	const commands = getMarkdownFormatCommands()
	const formatItems = markdownToolbarCommandIds.flatMap((commandId) => {
		const command = commands.get(commandId)
		return command ? [toSlashCommandItem(command)] : []
	})
	return [...formatItems, ...getTemplateSlashItems()]
}
