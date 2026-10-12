import { sortThreadsByPosition } from "@cortex/comments"
import {
	resolveCommentMentions,
	selectNoteComments,
	useCanWriteVaultPath,
	useCommentsStore,
	useVaultStore,
} from "@cortex/core"
import { Button, Kbd, TooltipProvider } from "@cortex/ui"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { useCommandHotkey } from "@/hooks/useCommandHotkey"
import { CommentComposer } from "./CommentComposer"
import { CommentThreadCard } from "./CommentThreadCard"
import { ADD_COMMENT_COMMAND_ID } from "./commentCommands"
import { type CommentPerson, useCommentPeople } from "./useCommentPeople"

interface CommentsPanelProps {
	filePath: string
}

function CommentDraftCard({
	vaultPath,
	filePath,
	people,
}: {
	vaultPath: string
	filePath: string
	people: readonly CommentPerson[]
}) {
	const draft = useCommentsStore((state) =>
		state.draft?.notePath === filePath ? state.draft : null,
	)
	if (!draft) return null
	const comments = useCommentsStore.getState()
	return (
		<article className="comment-thread is-focused" aria-label="New comment">
			<p className="comment-thread-quote">{draft.anchor.quote}</p>
			<CommentComposer
				people={people}
				placeholder="Add a comment, @ to mention"
				submitLabel="Comment"
				autoFocus
				onSubmit={async (body) => {
					await comments.createThread(
						vaultPath,
						filePath,
						draft.anchor,
						body,
						resolveCommentMentions(body),
					)
				}}
				onCancel={comments.cancelDraft}
			/>
		</article>
	)
}

export default function CommentsPanel({ filePath }: CommentsPanelProps) {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const file = useCommentsStore((state) => selectNoteComments(state, filePath))
	const focusedThreadId = useCommentsStore((state) => state.focusedThreadId)
	const ranges = useCommentsStore((state) =>
		state.anchorRanges?.notePath === filePath ? state.anchorRanges.ranges : null,
	)
	const addCommentHotkey = useCommandHotkey(ADD_COMMENT_COMMAND_ID)
	const hasDraft = useCommentsStore((state) => state.draft?.notePath === filePath)
	const canWrite = useCanWriteVaultPath(filePath)
	const people = useCommentPeople()
	const [showResolved, setShowResolved] = useState(false)

	const { openThreads, resolvedThreads } = useMemo(() => {
		const rangeMap = new Map(Object.entries(ranges ?? {}))
		const sorted = sortThreadsByPosition(Object.values(file.threads), rangeMap)
		return {
			openThreads: sorted.filter((thread) => thread.resolvedAt === null),
			resolvedThreads: sorted.filter((thread) => thread.resolvedAt !== null),
		}
	}, [file, ranges])

	if (!vaultPath) return null

	if (openThreads.length === 0 && resolvedThreads.length === 0 && !hasDraft) {
		return (
			<div className="comments-empty">
				<p>No comments yet.</p>
				<p>
					Select text and choose Comment
					{addCommentHotkey ? (
						<>
							{" "}
							or press <Kbd>{addCommentHotkey}</Kbd>
						</>
					) : null}{" "}
					to start a thread. Comments are stored next to the note, so the Markdown file stays clean.
				</p>
			</div>
		)
	}

	return (
		<TooltipProvider delayDuration={300}>
			<div className="comments-panel">
				{canWrite && <CommentDraftCard vaultPath={vaultPath} filePath={filePath} people={people} />}
				{openThreads.map((thread) => (
					<CommentThreadCard
						key={thread.id}
						vaultPath={vaultPath}
						notePath={filePath}
						threadId={thread.id}
						people={people}
						canWrite={canWrite}
						orphaned={ranges !== null && !ranges[thread.id]}
						focused={thread.id === focusedThreadId}
					/>
				))}
				{resolvedThreads.length > 0 && (
					<Button
						variant="ghost"
						size="xs"
						className="comments-resolved-toggle"
						aria-expanded={showResolved}
						onClick={() => setShowResolved((value) => !value)}
					>
						{showResolved ? <ChevronDownIcon /> : <ChevronRightIcon />}
						{showResolved ? "Hide resolved" : "Show resolved"} ({resolvedThreads.length})
					</Button>
				)}
				{showResolved &&
					resolvedThreads.map((thread) => (
						<CommentThreadCard
							key={thread.id}
							vaultPath={vaultPath}
							notePath={filePath}
							threadId={thread.id}
							people={people}
							canWrite={canWrite}
							orphaned={ranges !== null && !ranges[thread.id]}
							focused={false}
						/>
					))}
			</div>
		</TooltipProvider>
	)
}
