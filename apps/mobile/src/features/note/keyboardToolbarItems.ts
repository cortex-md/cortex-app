import type { MarkdownToolbarCommandId } from "@cortex/editor/markdown-format-commands"

import type { MenuGroup } from "@/components/ui/menuTypes"
import type { SymbolName } from "@/components/ui/Symbol"
import type { KeyboardToolbarAction } from "@/features/note/noteChromeTypes"

type MobileEditorCommandId =
	| "mobile.slash"
	| "mobile.insert-divider"
	| "mobile.insert-tag"
	| "mobile.insert-wikilink"

type EditorCommandId = MarkdownToolbarCommandId | MobileEditorCommandId

interface CommandSpec {
	commandId: EditorCommandId
	label: string
	icon: SymbolName
}

const primaryCommands: CommandSpec[] = [
	{
		commandId: "format.heading-1",
		label: "Heading",
		icon: { sf: "textformat.size", md: "format_h1" },
	},
	{ commandId: "format.bold", label: "Bold", icon: { sf: "bold", md: "format_bold" } },
	{ commandId: "format.italic", label: "Italic", icon: { sf: "italic", md: "format_italic" } },
	{ commandId: "format.task-list", label: "Task", icon: { sf: "checklist", md: "checklist" } },
	{
		commandId: "format.unordered-list",
		label: "List",
		icon: { sf: "list.bullet", md: "format_list_bulleted" },
	},
	{ commandId: "format.link", label: "Link", icon: { sf: "link", md: "link" } },
]

const formatCommands: CommandSpec[] = [
	{
		commandId: "format.strikethrough",
		label: "Strikethrough",
		icon: { sf: "strikethrough", md: "format_strikethrough" },
	},
	{
		commandId: "format.inline-code",
		label: "Inline code",
		icon: { sf: "chevron.left.forwardslash.chevron.right", md: "code" },
	},
]

const blockCommands: CommandSpec[] = [
	{
		commandId: "format.ordered-list",
		label: "Numbered list",
		icon: { sf: "list.number", md: "format_list_numbered" },
	},
	{
		commandId: "format.blockquote",
		label: "Quote",
		icon: { sf: "text.quote", md: "format_quote" },
	},
	{
		commandId: "format.code-block",
		label: "Code block",
		icon: { sf: "curlybraces", md: "data_object" },
	},
	{
		commandId: "mobile.insert-divider",
		label: "Divider",
		icon: { sf: "minus", md: "horizontal_rule" },
	},
]

const insertCommands: CommandSpec[] = [
	{
		commandId: "mobile.slash",
		label: "Slash command",
		icon: { sf: "command", md: "keyboard_command_key" },
	},
	{ commandId: "mobile.insert-tag", label: "Tag", icon: { sf: "number", md: "tag" } },
	{
		commandId: "mobile.insert-wikilink",
		label: "Wikilink",
		icon: { sf: "link.badge.plus", md: "add_link" },
	},
	{ commandId: "format.image", label: "Image", icon: { sf: "photo", md: "image" } },
]

export const HIDE_KEYBOARD_ICON: SymbolName = {
	sf: "keyboard.chevron.compact.down",
	md: "keyboard_hide",
}

export const MORE_ICON: SymbolName = { sf: "ellipsis", md: "more_horiz" }

function toMenuItem(spec: CommandSpec, run: (commandId: string) => void) {
	return {
		key: spec.commandId,
		label: spec.label,
		icon: spec.icon,
		onPress: () => run(spec.commandId),
	}
}

export function buildKeyboardToolbar(
	run: (commandId: string) => void,
	onInsertTemplate: () => void,
): { actions: KeyboardToolbarAction[]; more: MenuGroup[] } {
	const [slash, ...inserts] = insertCommands.map((spec) => toMenuItem(spec, run))
	return {
		actions: primaryCommands.map((spec) => toMenuItem(spec, run)),
		more: [
			formatCommands.map((spec) => toMenuItem(spec, run)),
			blockCommands.map((spec) => toMenuItem(spec, run)),
			[
				...(slash ? [slash] : []),
				{
					key: "insert-template",
					label: "Insert template",
					icon: { sf: "doc.badge.plus", md: "note_add" },
					onPress: onInsertTemplate,
				},
				...inserts,
			],
		],
	}
}
