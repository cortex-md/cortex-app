import type { CommandEntry, CommandExecutionContext } from "@cortex/commands"
import {
	insertCallout,
	insertCodeBlock,
	insertImage,
	insertInlineMath,
	insertLink,
	insertMathBlock,
	insertTable,
	removeParagraphFormatting,
	toggleBlockquote,
	toggleBold,
	toggleHeading,
	toggleInlineCode,
	toggleItalic,
	toggleOrderedList,
	toggleStrikethrough,
	toggleTaskList,
	toggleUnorderedList,
} from "./markdownCommands"
import type { FormatBinding } from "./markdownKeymap"
import type { SlashCommandItem } from "./slashCommands"
import type { EditorRuntimeView } from "./types"

export type MarkdownFormatCommandId =
	| "format.bold"
	| "format.italic"
	| "format.strikethrough"
	| "format.inline-code"
	| "format.inline-math"
	| "format.link"
	| "format.image"
	| "format.heading-1"
	| "format.heading-2"
	| "format.heading-3"
	| "format.blockquote"
	| "format.code-block"
	| "format.math-block"
	| "format.callout"
	| "format.task-list"
	| "format.unordered-list"
	| "format.ordered-list"
	| "format.table"
	| "editor.turn-into-text"

export interface MarkdownFormatCommandDefinition {
	id: MarkdownFormatCommandId
	label: string
	category: string
	aliases?: readonly string[]
	hotkey?: string
	run: (view: EditorRuntimeView, context: CommandExecutionContext) => boolean
}

export type MarkdownFormatCommandRunner = (
	command: (view: EditorRuntimeView) => boolean,
	context: CommandExecutionContext,
) => void

export const markdownFormatCommandDefinitions: readonly MarkdownFormatCommandDefinition[] = [
	{
		id: "format.bold",
		label: "Bold",
		category: "Format",
		aliases: ["bold"],
		hotkey: "mod+b",
		run: toggleBold,
	},
	{
		id: "format.italic",
		label: "Italic",
		category: "Format",
		aliases: ["italic"],
		hotkey: "mod+i",
		run: toggleItalic,
	},
	{
		id: "format.strikethrough",
		label: "Strikethrough",
		category: "Format",
		aliases: ["strikethrough"],
		hotkey: "mod+shift+x",
		run: toggleStrikethrough,
	},
	{
		id: "format.inline-code",
		label: "Inline Code",
		category: "Format",
		aliases: ["inline-code"],
		hotkey: "mod+`",
		run: toggleInlineCode,
	},
	{
		id: "format.inline-math",
		label: "Inline Formula",
		category: "Format",
		aliases: ["math", "formula", "equation", "latex", "inline-math"],
		run: insertInlineMath,
	},
	{
		id: "format.link",
		label: "Insert Link",
		category: "Format",
		aliases: ["insert-link", "link"],
		hotkey: "mod+k",
		run: insertLink,
	},
	{
		id: "format.image",
		label: "Insert Image",
		category: "Format",
		aliases: ["insert-image", "image"],
		hotkey: "mod+shift+k",
		run: insertImage,
	},
	{
		id: "format.heading-1",
		label: "Heading 1",
		category: "Format",
		aliases: ["heading-1"],
		hotkey: "mod+alt+1",
		run: (view) => toggleHeading(view, 1),
	},
	{
		id: "format.heading-2",
		label: "Heading 2",
		category: "Format",
		aliases: ["heading-2"],
		hotkey: "mod+alt+2",
		run: (view) => toggleHeading(view, 2),
	},
	{
		id: "format.heading-3",
		label: "Heading 3",
		category: "Format",
		aliases: ["heading-3"],
		hotkey: "mod+alt+3",
		run: (view) => toggleHeading(view, 3),
	},
	{
		id: "format.blockquote",
		label: "Blockquote",
		category: "Format",
		aliases: ["blockquote"],
		hotkey: "mod+shift+.",
		run: toggleBlockquote,
	},
	{
		id: "format.code-block",
		label: "Code Block",
		category: "Format",
		aliases: ["code-block"],
		hotkey: "mod+shift+`",
		run: insertCodeBlock,
	},
	{
		id: "format.math-block",
		label: "Formula Block",
		category: "Format",
		aliases: ["math block", "block math", "display math", "latex block"],
		run: insertMathBlock,
	},
	{
		id: "format.callout",
		label: "Callout",
		category: "Format",
		aliases: ["callout", "note-callout"],
		run: (view, context) => insertCallout(view, getPayloadString(context.payload, "calloutType")),
	},
	{
		id: "format.task-list",
		label: "Task List / Toggle Done",
		category: "Format",
		aliases: ["task-list", "toggle-task"],
		hotkey: "mod+l",
		run: toggleTaskList,
	},
	{
		id: "format.unordered-list",
		label: "Unordered List",
		category: "Format",
		aliases: ["unordered-list"],
		hotkey: "mod+shift+l",
		run: toggleUnorderedList,
	},
	{
		id: "format.ordered-list",
		label: "Ordered List",
		category: "Format",
		aliases: ["ordered-list"],
		hotkey: "mod+shift+o",
		run: toggleOrderedList,
	},
	{
		id: "format.table",
		label: "Insert Table",
		category: "Format",
		aliases: ["insert-table", "table"],
		hotkey: "mod+shift+y",
		run: insertTable,
	},
	{
		id: "editor.turn-into-text",
		label: "Turn into Text",
		category: "Editor",
		aliases: ["turn-text", "remove-formatting"],
		run: removeParagraphFormatting,
	},
]

export const markdownFormatCommandIds = markdownFormatCommandDefinitions.map(
	(definition) => definition.id,
)

export function createMarkdownFormatCommandEntries(
	runCommand: MarkdownFormatCommandRunner,
): CommandEntry[] {
	return markdownFormatCommandDefinitions.map((definition) => ({
		aliases: definition.aliases ? [...definition.aliases] : undefined,
		category: definition.category,
		hotkey: definition.hotkey ? { defaultKeys: definition.hotkey, scope: "editor" } : undefined,
		id: definition.id,
		label: definition.label,
		execute: (context) => runCommand((view) => definition.run(view, context), context),
	}))
}

export function createMarkdownFormatBindings(
	definitions: readonly MarkdownFormatCommandDefinition[] = markdownFormatCommandDefinitions,
): FormatBinding[] {
	return definitions.flatMap((definition) =>
		definition.hotkey ? [{ enabled: true, id: definition.id, keys: definition.hotkey }] : [],
	)
}

export function createMarkdownSlashCommandItems(
	definitions: readonly MarkdownFormatCommandDefinition[] = markdownFormatCommandDefinitions,
): SlashCommandItem[] {
	return definitions.map((definition) => ({
		aliases: definition.aliases,
		category: definition.category,
		id: definition.id,
		label: definition.label,
		shortcut: definition.hotkey,
	}))
}

function getPayloadString(payload: unknown, key: string): string | undefined {
	if (!payload || typeof payload !== "object") return undefined
	const value = (payload as Record<string, unknown>)[key]
	return typeof value === "string" ? value : undefined
}
