import { type CommandEntry, commandRegistry, getCommands } from "@cortex/commands"
import type { SlashCommandItem } from "@cortex/editor/slash-commands"

export const visibleMarkdownToolbarCommandIds = [
	"format.heading-1",
	"format.heading-2",
	"format.heading-3",
	"format.bold",
	"format.italic",
	"format.inline-math",
	"format.link",
	"format.unordered-list",
	"format.ordered-list",
	"format.task-list",
	"format.blockquote",
] as const

export const overflowMarkdownToolbarCommandIds = [
	"format.strikethrough",
	"format.inline-code",
	"format.code-block",
	"format.math-block",
	"format.callout",
	"format.image",
	"format.table",
	"format.drawing",
] as const

const markdownFormatCommandIds = [
	...visibleMarkdownToolbarCommandIds,
	...overflowMarkdownToolbarCommandIds,
] as const

const slashCommandIds = [...markdownFormatCommandIds, "database.create", "database.embed"] as const

export type MarkdownFormatCommandId = (typeof markdownFormatCommandIds)[number]

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
	return markdownFormatCommandIds
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
	return slashCommandIds.flatMap((commandId) => {
		const command = commands.get(commandId)
		return command ? [toSlashCommandItem(command)] : []
	})
}
