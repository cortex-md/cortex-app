import { type CommandEntry, executeCommand } from "@cortex/commands"
import type { EditorRuntimeView } from "@cortex/editor/types"
import { setEditorViewRef } from "@cortex/plugin-host-core"
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@cortex/ui"
import {
	BoldIcon,
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
	MessageSquareQuoteIcon,
	MoreHorizontalIcon,
	PenLineIcon,
	QuoteIcon,
	SigmaIcon,
	SquareSigmaIcon,
	StrikethroughIcon,
	Table2Icon,
} from "lucide-react"
import { useCallback, useSyncExternalStore } from "react"
import {
	getMarkdownFormatCommands,
	getMarkdownFormatCommandsSnapshot,
	type MarkdownFormatCommandId,
	overflowMarkdownToolbarCommandIds,
	subscribeMarkdownFormatCommands,
	visibleMarkdownToolbarCommandIds,
} from "./markdownFormatActions"

interface MarkdownToolbarProps {
	getEditorView: () => EditorRuntimeView | null
}

interface MarkdownToolbarButtonProps {
	command: CommandEntry
	icon: LucideIcon
	onRunCommand: (command: CommandEntry) => void
}

const markdownToolbarIcons: Record<MarkdownFormatCommandId, LucideIcon> = {
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
}

function getToolbarCommands(commandIds: readonly MarkdownFormatCommandId[]): CommandEntry[] {
	const commands = getMarkdownFormatCommands()
	return commandIds.flatMap((commandId) => {
		const command = commands.get(commandId)
		return command ? [command] : []
	})
}

function MarkdownToolbarButton({ command, icon: Icon, onRunCommand }: MarkdownToolbarButtonProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="markdown-toolbar-button"
					aria-label={command.label}
					title={command.label}
					data-markdown-toolbar-command={command.id}
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => onRunCommand(command)}
				>
					<Icon className="size-[15px]" aria-hidden="true" />
				</Button>
			</TooltipTrigger>
			<TooltipContent side="top" sideOffset={6}>
				{command.label}
			</TooltipContent>
		</Tooltip>
	)
}

export function MarkdownToolbar({ getEditorView }: MarkdownToolbarProps) {
	useSyncExternalStore(
		subscribeMarkdownFormatCommands,
		getMarkdownFormatCommandsSnapshot,
		getMarkdownFormatCommandsSnapshot,
	)
	const visibleCommands = getToolbarCommands(visibleMarkdownToolbarCommandIds)
	const overflowCommands = getToolbarCommands(overflowMarkdownToolbarCommandIds)
	const handleRunCommand = useCallback(
		(command: CommandEntry) => {
			const view = getEditorView()
			if (!view) return
			setEditorViewRef(view as never)
			view.focus()
			executeCommand(command.id, { source: "api" })
		},
		[getEditorView],
	)

	if (visibleCommands.length === 0 && overflowCommands.length === 0) return null

	return (
		<TooltipProvider delayDuration={500}>
			<div className="markdown-toolbar-shell">
				<div className="markdown-toolbar-scroll">
					<div className="markdown-toolbar-group" role="toolbar" aria-label="Markdown formatting">
						{visibleCommands.map((command) => (
							<MarkdownToolbarButton
								key={command.id}
								command={command}
								icon={markdownToolbarIcons[command.id as MarkdownFormatCommandId]}
								onRunCommand={handleRunCommand}
							/>
						))}
						{overflowCommands.length > 0 && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="markdown-toolbar-button"
										aria-label="More Markdown actions"
										title="More Markdown actions"
										data-markdown-toolbar-overflow=""
									>
										<MoreHorizontalIcon className="size-[15px]" aria-hidden="true" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start" className="markdown-toolbar-menu">
									{overflowCommands.map((command) => {
										const Icon = markdownToolbarIcons[command.id as MarkdownFormatCommandId]
										return (
											<DropdownMenuItem
												key={command.id}
												data-markdown-toolbar-command={command.id}
												onSelect={() => handleRunCommand(command)}
											>
												<Icon className="size-4" aria-hidden="true" />
												{command.label}
											</DropdownMenuItem>
										)
									})}
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				</div>
			</div>
		</TooltipProvider>
	)
}
