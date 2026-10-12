import {
	filterMentionCandidates,
	findDisplayMentions,
	toDisplayMentionText,
	toStoredMentionText,
} from "@cortex/comments"
import {
	Button,
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
	InputGroup,
	InputGroupAddon,
	InputGroupTextarea,
} from "@cortex/ui"
import { type KeyboardEvent, useMemo, useRef, useState } from "react"
import { UserAvatar } from "../sync/UserAvatar"
import type { CommentPerson } from "./useCommentPeople"

interface CommentComposerProps {
	people: readonly CommentPerson[]
	placeholder: string
	submitLabel: string
	initialValue?: string
	autoFocus?: boolean
	onSubmit: (body: string) => Promise<void> | void
	onCancel?: () => void
}

interface MentionQuery {
	query: string
	start: number
	end: number
}

interface BackdropSegment {
	start: number
	text: string
	mention: boolean
}

const MENTION_QUERY_PATTERN = /(?:^|\s)@([^\s@[\]]{0,32})$/

function readMentionQuery(value: string, caret: number): MentionQuery | null {
	const match = MENTION_QUERY_PATTERN.exec(value.slice(0, caret))
	if (!match) return null
	const query = match[1] ?? ""
	return { query, start: caret - query.length - 1, end: caret }
}

function toBackdropSegments(value: string, names: readonly string[]): BackdropSegment[] {
	const segments: BackdropSegment[] = []
	let cursor = 0
	for (const mention of findDisplayMentions(value, names)) {
		if (mention.start > cursor) {
			segments.push({ start: cursor, text: value.slice(cursor, mention.start), mention: false })
		}
		segments.push({
			start: mention.start,
			text: value.slice(mention.start, mention.end),
			mention: true,
		})
		cursor = mention.end
	}
	segments.push({ start: cursor, text: `${value.slice(cursor)}​`, mention: false })
	return segments
}

export function CommentComposer({
	people,
	placeholder,
	submitLabel,
	initialValue = "",
	autoFocus = false,
	onSubmit,
	onCancel,
}: CommentComposerProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const backdropRef = useRef<HTMLDivElement>(null)
	const [value, setValue] = useState(() => toDisplayMentionText(initialValue))
	const [mention, setMention] = useState<MentionQuery | null>(null)
	const [highlighted, setHighlighted] = useState(0)
	const [submitting, setSubmitting] = useState(false)
	const names = useMemo(() => people.map((person) => person.name), [people])
	const segments = useMemo(() => toBackdropSegments(value, names), [value, names])
	const matches = mention ? filterMentionCandidates(people, mention.query, 6) : []
	const menuOpen = matches.length > 0
	const activeIndex = Math.min(highlighted, Math.max(matches.length - 1, 0))

	const updateValue = (nextValue: string, caret: number) => {
		setValue(nextValue)
		setMention(readMentionQuery(nextValue, caret))
		setHighlighted(0)
	}

	const insertMention = (person: CommentPerson) => {
		if (!mention) return
		const token = `@${person.name} `
		const nextValue = `${value.slice(0, mention.start)}${token}${value.slice(mention.end)}`
		const caret = mention.start + token.length
		setValue(nextValue)
		setMention(null)
		requestAnimationFrame(() => {
			textareaRef.current?.focus()
			textareaRef.current?.setSelectionRange(caret, caret)
		})
	}

	const submit = async () => {
		const body = toStoredMentionText(value, names).trim()
		if (!body || submitting) return
		setSubmitting(true)
		try {
			await onSubmit(body)
			setValue("")
			setMention(null)
		} finally {
			setSubmitting(false)
		}
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.nativeEvent.isComposing) return
		if (menuOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
			event.preventDefault()
			const delta = event.key === "ArrowDown" ? 1 : -1
			setHighlighted((activeIndex + delta + matches.length) % matches.length)
			return
		}
		if (menuOpen && (event.key === "Enter" || event.key === "Tab")) {
			event.preventDefault()
			const person = matches[activeIndex]
			if (person) insertMention(person)
			return
		}
		if (event.key === "Escape") {
			if (menuOpen) {
				event.preventDefault()
				setMention(null)
			} else if (onCancel) {
				event.preventDefault()
				onCancel()
			}
			return
		}
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault()
			void submit()
		}
	}

	return (
		<div className="comment-composer">
			{menuOpen && (
				<div className="comment-mention-menu" data-command-surface="">
					<Command
						shouldFilter={false}
						value={matches[activeIndex]?.userId ?? ""}
						onMouseDown={(event) => event.preventDefault()}
					>
						<CommandList>
							<CommandGroup heading="Mention someone">
								{matches.map((person, index) => (
									<CommandItem
										key={person.userId}
										value={person.userId}
										data-active={index === activeIndex ? "true" : undefined}
										onMouseMove={() => setHighlighted(index)}
										onSelect={() => insertMention(person)}
									>
										<UserAvatar name={person.name} avatarUrl={person.avatarUrl} size="sm" />
										<span className="command-item-title">{person.name}</span>
										{person.role && <span className="comment-mention-role">{person.role}</span>}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</div>
			)}
			<InputGroup className="comment-composer-field">
				<div className="comment-composer-input">
					<div ref={backdropRef} className="comment-composer-backdrop" aria-hidden="true">
						{segments.map((segment) =>
							segment.mention ? (
								<mark key={segment.start} className="comment-composer-mention">
									{segment.text}
								</mark>
							) : (
								<span key={segment.start}>{segment.text}</span>
							),
						)}
					</div>
					<InputGroupTextarea
						ref={textareaRef}
						value={value}
						rows={1}
						placeholder={placeholder}
						aria-label={placeholder}
						autoFocus={autoFocus}
						disabled={submitting}
						onChange={(event) =>
							updateValue(
								event.target.value,
								event.target.selectionStart ?? event.target.value.length,
							)
						}
						onKeyDown={handleKeyDown}
						onScroll={(event) => {
							if (backdropRef.current) backdropRef.current.scrollTop = event.currentTarget.scrollTop
						}}
						onBlur={() => setMention(null)}
					/>
				</div>
				<InputGroupAddon align="block-end" className="comment-composer-actions">
					{onCancel && (
						<Button variant="ghost" size="xs" onClick={onCancel}>
							Cancel
						</Button>
					)}
					<Button size="xs" disabled={!value.trim() || submitting} onClick={() => void submit()}>
						{submitLabel}
					</Button>
				</InputGroupAddon>
			</InputGroup>
		</div>
	)
}
