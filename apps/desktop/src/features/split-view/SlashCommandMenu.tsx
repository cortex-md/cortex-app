import type { SlashCommandMenuState } from "@cortex/editor/slash-commands"
import {
	Command,
	CommandEmpty,
	CommandFooter,
	CommandFooterHint,
	CommandFooterKey,
	CommandGroup,
	CommandItem,
	CommandList,
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
	PenLineIcon,
	QuoteIcon,
	SigmaIcon,
	SquareSigmaIcon,
	StrikethroughIcon,
	Table2Icon,
} from "lucide-react"
import { useCallback, useEffect, useRef } from "react"
import { createPortal } from "react-dom"

interface SlashCommandMenuProps {
	state: SlashCommandMenuState | null
}

const slashCommandFooterHints = [
	{ keys: ["↑", "↓"], label: "navigate" },
	{ keys: ["Return"], label: "run" },
	{ keys: ["Esc"], label: "close" },
]

const slashCommandIcons: Record<string, LucideIcon> = {
	"format.heading-1": Heading1Icon,
	"format.heading-2": Heading2Icon,
	"format.heading-3": Heading3Icon,
	"format.unordered-list": ListIcon,
	"format.ordered-list": ListOrderedIcon,
	"format.task-list": ListTodoIcon,
	"format.blockquote": QuoteIcon,
	"format.code-block": Code2Icon,
	"format.callout": MessageSquareQuoteIcon,
	"format.table": Table2Icon,
	"format.drawing": PenLineIcon,
	"format.inline-math": SigmaIcon,
	"format.math-block": SquareSigmaIcon,
	"format.link": LinkIcon,
	"format.image": ImageIcon,
	"format.bold": BoldIcon,
	"format.italic": ItalicIcon,
	"format.inline-code": CodeIcon,
	"format.strikethrough": StrikethroughIcon,
}

export function SlashCommandMenu({ state }: SlashCommandMenuProps) {
	const itemRefs = useRef<Map<string, HTMLElement> | null>(null)
	if (itemRefs.current === null) {
		itemRefs.current = new Map()
	}
	const selectedIndex = state?.selectedIndex ?? -1
	const items = state?.items
	const activeCommandId = items?.[selectedIndex]?.id ?? ""

	const handleCommandValueChange = useCallback(
		(commandId: string) => {
			if (!state) return
			const nextIndex = state.items.findIndex((item) => item.id === commandId)
			if (nextIndex >= 0 && nextIndex !== state.selectedIndex) {
				state.select(nextIndex)
			}
		},
		[state],
	)

	useEffect(() => {
		const currentCommandId = items?.[selectedIndex]?.id
		if (!currentCommandId) return
		itemRefs.current?.get(currentCommandId)?.scrollIntoView({ block: "nearest" })
	}, [items, selectedIndex])

	if (!state || typeof document === "undefined") return null

	return createPortal(
		<div
			data-command-surface=""
			data-placement={state.position.placement}
			className="slash-command-menu"
			style={{
				left: state.position.left,
				top: state.position.top,
				transform: state.position.placement === "top" ? "translateY(-100%)" : undefined,
			}}
		>
			<Command
				shouldFilter={false}
				loop={false}
				value={activeCommandId}
				onValueChange={handleCommandValueChange}
				onMouseDown={(event) => event.preventDefault()}
			>
				<CommandList className="slash-command-list">
					<CommandEmpty>No Markdown commands found</CommandEmpty>
					{state.items.length > 0 && (
						<CommandGroup>
							{state.items.map((command, index) => (
								<CommandItem
									key={command.id}
									value={command.id}
									data-active={index === state.selectedIndex ? "true" : undefined}
									ref={(element) => {
										if (element) {
											itemRefs.current?.set(command.id, element)
										} else {
											itemRefs.current?.delete(command.id)
										}
									}}
									onMouseMove={() => state.select(index)}
									onSelect={() => state.execute(command.id)}
								>
									<SlashCommandIcon commandId={command.id} />
									<span className="command-item-copy">
										<span className="command-item-title">{command.label}</span>
										<span className="command-item-meta">{command.category}</span>
									</span>
								</CommandItem>
							))}
						</CommandGroup>
					)}
				</CommandList>
				<CommandFooter>
					{slashCommandFooterHints.map((hint) => (
						<CommandFooterHint key={`${hint.keys.join("-")}-${hint.label}`}>
							{hint.keys.map((key) => (
								<CommandFooterKey key={key}>{key}</CommandFooterKey>
							))}
							{hint.label}
						</CommandFooterHint>
					))}
				</CommandFooter>
			</Command>
		</div>,
		document.body,
	)
}

function SlashCommandIcon({ commandId }: { commandId: string }) {
	const Icon = slashCommandIcons[commandId] ?? CodeIcon

	return (
		<span className="slash-command-icon" aria-hidden="true">
			<Icon className="size-[15px]" data-slash-command-icon={commandId} />
		</span>
	)
}
