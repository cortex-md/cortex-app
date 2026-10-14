import {
	createTaskLine,
	describeRepeat,
	formatRelativeDay,
	parseQuickAdd,
	type QuickAddResult,
} from "@cortex/tasks"
import { Button, InputGroup, InputGroupAddon, InputGroupInput, Kbd } from "@cortex/ui"
import { CalendarIcon, ClockIcon, InboxIcon, PlusIcon, RepeatIcon } from "lucide-react"
import { type KeyboardEvent, type Ref, useDeferredValue, useState } from "react"
import { addTaskFromQuickAdd } from "./taskModel"

type QuickAddVariant = "page" | "sidebar"

interface TaskQuickAddProps {
	today: string
	variant: QuickAddVariant
	inputRef?: Ref<HTMLInputElement>
	placeholder?: string
	onDismiss?: () => void
}

function QuickAddTokens({ parsed, today }: { parsed: QuickAddResult; today: string }) {
	return (
		<>
			{parsed.due && (
				<span className="task-token">
					<CalendarIcon className="size-3" aria-hidden="true" />
					{formatRelativeDay(parsed.due, today)}
				</span>
			)}
			{parsed.time && (
				<span className="task-token">
					<ClockIcon className="size-3" aria-hidden="true" />
					{parsed.time}
				</span>
			)}
			{parsed.repeat && (
				<span className="task-token">
					<RepeatIcon className="size-3" aria-hidden="true" />
					{describeRepeat(parsed.repeat)}
				</span>
			)}
			{!parsed.due && (
				<span className="task-token" data-muted="true">
					<InboxIcon className="size-3" aria-hidden="true" />
					Inbox
				</span>
			)}
		</>
	)
}

export function TaskQuickAdd({
	today,
	variant,
	inputRef,
	placeholder = "Add a task…",
	onDismiss,
}: TaskQuickAddProps) {
	const [draft, setDraft] = useState("")
	const [submitting, setSubmitting] = useState(false)
	const deferredDraft = useDeferredValue(draft)
	const parsed = deferredDraft.trim() ? parseQuickAdd(deferredDraft, today) : null

	const handleKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Escape") {
			event.preventDefault()
			setDraft("")
			onDismiss?.()
			return
		}
		if (event.key !== "Enter" || event.nativeEvent.isComposing || submitting) return
		event.preventDefault()
		const result = parseQuickAdd(draft, today)
		if (!result.title) return
		const input = event.currentTarget
		setSubmitting(true)
		const added = await addTaskFromQuickAdd(result)
		setSubmitting(false)
		if (added) setDraft("")
		requestAnimationFrame(() => {
			if (input.isConnected) input.focus()
		})
	}

	const handleBlur = () => {
		if (!draft.trim()) onDismiss?.()
	}

	return (
		<div className="task-quick-add" data-variant={variant}>
			<InputGroup className="task-quick-add-field" aria-label="Add a task">
				<InputGroupAddon>
					<PlusIcon />
				</InputGroupAddon>
				<InputGroupInput
					ref={inputRef}
					value={draft}
					disabled={submitting}
					placeholder={placeholder}
					autoFocus={variant === "sidebar"}
					onBlur={handleBlur}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={(event) => void handleKeyDown(event)}
				/>
				{variant === "page" && (
					<InputGroupAddon align="inline-end">
						<Kbd className="task-kbd">↵</Kbd>
					</InputGroupAddon>
				)}
			</InputGroup>
			{parsed?.title && (
				<div className="task-quick-add-parse" aria-live="polite">
					<QuickAddTokens parsed={parsed} today={today} />
					{variant === "page" && (
						<code className="task-quick-add-line">
							{createTaskLine({
								status: "open",
								title: parsed.title,
								due: parsed.due,
								time: parsed.time,
								repeat: parsed.repeat,
							})}
						</code>
					)}
				</div>
			)}
		</div>
	)
}

export function TaskQuickAddTrigger({
	shortcut,
	onActivate,
}: {
	shortcut: string | null
	onActivate: () => void
}) {
	return (
		<Button size="sm" variant="ghost" className="task-quick-add-trigger" onClick={onActivate}>
			<PlusIcon className="size-3.5" aria-hidden="true" />
			<span>Add a task…</span>
			{shortcut && <Kbd className="task-kbd">{shortcut}</Kbd>}
		</Button>
	)
}
