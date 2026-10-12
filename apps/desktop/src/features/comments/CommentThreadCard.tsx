import { sortedMessages } from "@cortex/comments"
import {
	getCommentAuthorId,
	resolveCommentMentions,
	selectNoteComments,
	useCommentsStore,
} from "@cortex/core"
import { Button, cn } from "@cortex/ui"
import { CheckIcon, RotateCcwIcon } from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef } from "react"
import { formatCount } from "@/utils/format"
import { CommentComposer } from "./CommentComposer"
import { CommentMessageItem } from "./CommentMessageItem"
import type { CommentPerson } from "./useCommentPeople"

const FOCUS_FLASH_TIMING: KeyframeAnimationOptions = { duration: 900, easing: "ease-out" }

interface CommentThreadCardProps {
	vaultPath: string
	notePath: string
	threadId: string
	people: readonly CommentPerson[]
	canWrite: boolean
	orphaned: boolean
	focused: boolean
}

export const CommentThreadCard = memo(function CommentThreadCard({
	vaultPath,
	notePath,
	threadId,
	people,
	canWrite,
	orphaned,
	focused,
}: CommentThreadCardProps) {
	const thread = useCommentsStore((state) => selectNoteComments(state, notePath).threads[threadId])
	const messages = useMemo(() => (thread ? sortedMessages(thread) : []), [thread])
	const cardRef = useRef<HTMLElement>(null)
	const focusRequestId = useCommentsStore((state) =>
		state.focusedThreadId === threadId ? state.focusRequestId : 0,
	)
	useEffect(() => {
		const card = cardRef.current
		if (!focusRequestId || !card) return
		card.scrollIntoView({ block: "nearest", behavior: "smooth" })
		const styles = getComputedStyle(card)
		for (const animation of card.getAnimations()) animation.cancel()
		card.animate(
			[
				{ backgroundColor: styles.getPropertyValue("--bg-hover") },
				{ backgroundColor: styles.getPropertyValue("--bg-primary") },
			],
			FOCUS_FLASH_TIMING,
		)
	}, [focusRequestId])
	const edit = useCallback(
		(messageId: string, body: string) =>
			useCommentsStore
				.getState()
				.editComment(vaultPath, notePath, threadId, messageId, body, resolveCommentMentions(body)),
		[vaultPath, notePath, threadId],
	)
	const remove = useCallback(
		(messageId: string) =>
			useCommentsStore.getState().deleteComment(vaultPath, notePath, threadId, messageId),
		[vaultPath, notePath, threadId],
	)
	if (!thread) return null

	const resolved = thread.resolvedAt !== null
	const currentAuthorId = getCommentAuthorId()
	const comments = useCommentsStore.getState()

	const focus = () => comments.focusThread(threadId, { reveal: !orphaned })
	const toggleResolved = () =>
		void comments.setThreadResolved(vaultPath, notePath, threadId, !resolved)
	const reply = (body: string) =>
		comments.replyToThread(vaultPath, notePath, threadId, body, resolveCommentMentions(body))

	return (
		<article
			ref={cardRef}
			className={cn(
				"comment-thread",
				focused && !resolved && "is-focused",
				resolved && "is-resolved",
			)}
			aria-label={`Comment thread on “${thread.anchor.quote}”`}
			onFocusCapture={() => {
				if (!focused) comments.focusThread(threadId)
			}}
		>
			<header className="comment-thread-header">
				<span>{resolved ? "Resolved" : formatCount(messages.length, "comment")}</span>
				{canWrite && (
					<Button variant="ghost" size="xs" onClick={toggleResolved}>
						{resolved ? <RotateCcwIcon /> : <CheckIcon />}
						{resolved ? "Reopen" : "Resolve"}
					</Button>
				)}
			</header>
			<button type="button" className="comment-thread-quote" onClick={focus}>
				{thread.anchor.quote}
			</button>
			{orphaned && <p className="comment-thread-orphaned">Original text changed</p>}
			<div className="comment-thread-messages">
				{messages.map((message) => (
					<CommentMessageItem
						key={message.id}
						message={message}
						people={people}
						canEdit={canWrite && message.authorId === currentAuthorId}
						onEdit={edit}
						onDelete={remove}
					/>
				))}
			</div>
			{canWrite && !resolved && (
				<CommentComposer
					people={people}
					placeholder="Reply, @ to mention"
					submitLabel="Send"
					onSubmit={reply}
				/>
			)}
		</article>
	)
})
