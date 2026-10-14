import { type CommandEntry, executeCommand } from "@cortex/commands"
import { selectionToolbarLayout } from "@cortex/editor/markdown-format-commands"
import type { SelectionToolbarState } from "@cortex/editor/selection-toolbar"
import type { EditorRuntimeView } from "@cortex/editor/types"
import { setEditorViewRef } from "@cortex/plugin-host-core"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Toggle,
	Toolbar,
	ToolbarSeparator,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@cortex/ui"
import {
	BoldIcon,
	ChevronDownIcon,
	Code2Icon,
	CodeIcon,
	Heading1Icon,
	Heading2Icon,
	Heading3Icon,
	ImageIcon,
	ItalicIcon,
	LinkIcon,
	ListIcon,
	ListOrderedIcon,
	ListTodoIcon,
	type LucideIcon,
	MessageSquarePlusIcon,
	MessageSquareQuoteIcon,
	MoreHorizontalIcon,
	PenLineIcon,
	PilcrowIcon,
	QuoteIcon,
	SigmaIcon,
	SquareSigmaIcon,
	StrikethroughIcon,
	Table2Icon,
} from "lucide-react"
import { useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import {
	getMarkdownFormatCommands,
	getMarkdownFormatCommandsSnapshot,
	subscribeMarkdownFormatCommands,
} from "./markdownFormatActions"

interface SelectionToolbarProps {
	state: SelectionToolbarState
	showFormatting: boolean
	getEditorView: () => EditorRuntimeView | null
	onMenuOpenChange: (open: boolean) => void
}

const toolbarIcons: Record<string, LucideIcon> = {
	"editor.turn-into-text": PilcrowIcon,
	"format.heading-1": Heading1Icon,
	"format.heading-2": Heading2Icon,
	"format.heading-3": Heading3Icon,
	"format.bold": BoldIcon,
	"format.italic": ItalicIcon,
	"format.inline-math": SigmaIcon,
	"format.link": LinkIcon,
	"format.unordered-list": ListIcon,
	"format.ordered-list": ListOrderedIcon,
	"format.task-list": ListTodoIcon,
	"format.blockquote": QuoteIcon,
	"format.strikethrough": StrikethroughIcon,
	"format.inline-code": CodeIcon,
	"format.code-block": Code2Icon,
	"format.math-block": SquareSigmaIcon,
	"format.callout": MessageSquareQuoteIcon,
	"format.image": ImageIcon,
	"format.table": Table2Icon,
	"format.drawing": PenLineIcon,
	"comments.add": MessageSquarePlusIcon,
}

function pickCommands(
	commands: Map<string, CommandEntry>,
	commandIds: readonly string[],
): CommandEntry[] {
	return commandIds.flatMap((commandId) => {
		const command = commands.get(commandId)
		return command ? [command] : []
	})
}

function keepEditorFocus(event: React.MouseEvent) {
	event.preventDefault()
}

function CommandMenu({
	trigger,
	label,
	commands,
	onRun,
	onOpenChange,
}: {
	trigger: React.ReactNode
	label: string
	commands: CommandEntry[]
	onRun: (command: CommandEntry) => void
	onOpenChange: (open: boolean) => void
}) {
	return (
		<DropdownMenu modal={false} onOpenChange={onOpenChange}>
			<DropdownMenuTrigger asChild>
				<Toggle
					size="sm"
					className="selection-toolbar-menu-trigger"
					aria-label={label}
					onMouseDown={keepEditorFocus}
				>
					{trigger}
				</Toggle>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="selection-toolbar-menu"
				onCloseAutoFocus={(event) => event.preventDefault()}
			>
				{commands.map((command) => {
					const Icon = toolbarIcons[command.id]
					return (
						<DropdownMenuItem key={command.id} onSelect={() => onRun(command)}>
							{Icon && <Icon aria-hidden="true" />}
							{command.label}
						</DropdownMenuItem>
					)
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function CommandButton({
	command,
	onRun,
	showLabel = false,
}: {
	command: CommandEntry
	onRun: (command: CommandEntry) => void
	showLabel?: boolean
}) {
	const Icon = toolbarIcons[command.id]
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Toggle
					size="sm"
					pressed={false}
					aria-label={command.label}
					data-markdown-toolbar-command={command.id}
					onMouseDown={keepEditorFocus}
					onClick={() => onRun(command)}
				>
					{Icon && <Icon aria-hidden="true" />}
					{showLabel && <span>{command.label.replace(/^Add /, "")}</span>}
				</Toggle>
			</TooltipTrigger>
			<TooltipContent side="top" sideOffset={6}>
				{command.label}
			</TooltipContent>
		</Tooltip>
	)
}

export function SelectionToolbar({
	state,
	showFormatting,
	getEditorView,
	onMenuOpenChange,
}: SelectionToolbarProps) {
	useSyncExternalStore(
		subscribeMarkdownFormatCommands,
		getMarkdownFormatCommandsSnapshot,
		getMarkdownFormatCommandsSnapshot,
	)
	const commands = getMarkdownFormatCommands()
	const pickFormatting = (commandIds: readonly string[]) =>
		showFormatting ? pickCommands(commands, commandIds) : []
	const turnIntoCommands = pickFormatting(selectionToolbarLayout.turnInto)
	const inlineCommands = pickFormatting(selectionToolbarLayout.inline)
	const blockCommands = pickFormatting(selectionToolbarLayout.block)
	const annotateCommands = pickCommands(commands, selectionToolbarLayout.annotate)
	const overflowCommands = pickFormatting(selectionToolbarLayout.overflow)

	const handleMenuOpenChange = (open: boolean) => {
		onMenuOpenChange(open)
		if (!open) getEditorView()?.focus()
	}

	const runCommand = (command: CommandEntry) => {
		const view = getEditorView()
		if (!view) return
		setEditorViewRef(view as never)
		view.focus()
		executeCommand(command.id, { source: "api" })
	}

	return createPortal(
		<TooltipProvider delayDuration={500}>
			<Toolbar
				className="selection-toolbar"
				aria-label="Format selection"
				data-placement={state.position.placement}
				style={{ left: state.position.left, top: state.position.top }}
				onMouseDown={keepEditorFocus}
			>
				{turnIntoCommands.length > 0 && (
					<CommandMenu
						label="Turn into"
						commands={turnIntoCommands}
						onRun={runCommand}
						onOpenChange={handleMenuOpenChange}
						trigger={
							<>
								Text
								<ChevronDownIcon aria-hidden="true" />
							</>
						}
					/>
				)}
				{showFormatting && <ToolbarSeparator />}
				{inlineCommands.map((command) => (
					<CommandButton key={command.id} command={command} onRun={runCommand} />
				))}
				{showFormatting && <ToolbarSeparator />}
				{blockCommands.map((command) => (
					<CommandButton key={command.id} command={command} onRun={runCommand} />
				))}
				{overflowCommands.length > 0 && (
					<CommandMenu
						label="More Markdown actions"
						commands={overflowCommands}
						onRun={runCommand}
						onOpenChange={handleMenuOpenChange}
						trigger={<MoreHorizontalIcon aria-hidden="true" />}
					/>
				)}
				{showFormatting && annotateCommands.length > 0 && <ToolbarSeparator />}
				{annotateCommands.map((command) => (
					<CommandButton
						key={command.id}
						command={command}
						onRun={runCommand}
						showLabel={!showFormatting}
					/>
				))}
			</Toolbar>
		</TooltipProvider>,
		document.body,
	)
}
