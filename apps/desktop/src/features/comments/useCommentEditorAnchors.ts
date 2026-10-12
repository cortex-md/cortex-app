import {
	anchorAtRange,
	type CommentAnchor,
	type CommentsFile,
	MENTION_PATTERN,
	type ResolvedAnchorRange,
	resolveAnchor,
	sortedMessages,
} from "@cortex/comments"
import {
	type CommentDraft,
	selectNoteComments,
	useCommentsStore,
	useMembersStore,
	useUIStore,
	useVaultStore,
} from "@cortex/core"
import {
	type CommentAnchorRange,
	type CommentThreadPreview,
	commentsExtension,
	getCommentAnchorRanges,
	revealCommentAnchor,
	setCommentAnchors,
} from "@cortex/editor/comments"
import type { EditorExtensionFactory, EditorRuntimeView } from "@cortex/editor/types"
import { type RefObject, useEffect, useEffectEvent, useMemo } from "react"
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback"
import { formatRelativeTime } from "@/utils/format"
import { findCommentPerson, toCommentPerson } from "./useCommentPeople"

export const DRAFT_THREAD_ID = "draft"

const PERSIST_ANCHORS_DELAY_MS = 1500

interface UseCommentEditorAnchorsOptions {
	filePath: string
	isActive: boolean
	viewRef: RefObject<EditorRuntimeView | null>
}

function openCommentsPanel(): void {
	useUIStore.getState().setRightSidebarLayout({ collapsed: false, panel: "comments" })
}

function resolveThreadRanges(
	body: string,
	file: CommentsFile,
	mappedRanges: ReadonlyMap<string, ResolvedAnchorRange> | null,
): Record<string, ResolvedAnchorRange | null> {
	const ranges: Record<string, ResolvedAnchorRange | null> = {}
	for (const thread of Object.values(file.threads)) {
		ranges[thread.id] = mappedRanges?.get(thread.id) ?? resolveAnchor(body, thread.anchor)
	}
	return ranges
}

function toEditorRanges(
	file: CommentsFile,
	ranges: Record<string, ResolvedAnchorRange | null>,
	draft: CommentDraft | null,
	filePath: string,
): CommentAnchorRange[] {
	const editorRanges: CommentAnchorRange[] = []
	for (const thread of Object.values(file.threads)) {
		const range = ranges[thread.id]
		if (range)
			editorRanges.push({ threadId: thread.id, ...range, resolved: thread.resolvedAt !== null })
	}
	if (draft?.notePath === filePath) {
		editorRanges.push({
			threadId: DRAFT_THREAD_ID,
			from: draft.anchor.from,
			to: draft.anchor.to,
			resolved: false,
		})
	}
	return editorRanges
}

export function useCommentEditorAnchors({
	filePath,
	isActive,
	viewRef,
}: UseCommentEditorAnchorsOptions): EditorExtensionFactory {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const file = useCommentsStore((state) => selectNoteComments(state, filePath))
	const focusedThreadId = useCommentsStore((state) => state.focusedThreadId)
	const draft = useCommentsStore((state) => state.draft)
	const revealRequest = useCommentsStore((state) => state.revealRequest)

	useEffect(() => {
		if (vaultPath) void useCommentsStore.getState().loadNoteComments(vaultPath, filePath)
	}, [vaultPath, filePath])

	const pushAnchors = useEffectEvent(
		async (fromScratch: boolean, readyView?: EditorRuntimeView) => {
			const view = readyView ?? viewRef.current
			if (!view) return
			const mappedRanges = fromScratch ? null : await getCommentAnchorRanges(view)
			const ranges = resolveThreadRanges(view.state.doc.toString(), file, mappedRanges)
			await setCommentAnchors(view, {
				ranges: toEditorRanges(file, ranges, draft, filePath),
				focusedThreadId: draft?.notePath === filePath ? DRAFT_THREAD_ID : focusedThreadId,
			})
			if (isActive) useCommentsStore.getState().setAnchorRanges({ notePath: filePath, ranges })
		},
	)

	const persistAnchors = useDebouncedCallback(async () => {
		const view = viewRef.current
		if (!view || !vaultPath) return
		const body = view.state.doc.toString()
		const mappedRanges = await getCommentAnchorRanges(view)
		const anchors = new Map<string, CommentAnchor>()
		for (const thread of Object.values(file.threads)) {
			const range = mappedRanges.get(thread.id)
			if (range) anchors.set(thread.id, anchorAtRange(body, thread.anchor, range))
		}
		if (anchors.size > 0) {
			await useCommentsStore.getState().saveAnchors(vaultPath, filePath, anchors)
		}
		if (isActive) {
			useCommentsStore.getState().setAnchorRanges({
				notePath: filePath,
				ranges: resolveThreadRanges(body, file, mappedRanges),
			})
		}
	}, PERSIST_ANCHORS_DELAY_MS)

	// biome-ignore lint/correctness/useExhaustiveDependencies: these values are change signals; pushAnchors reads the latest copies
	useEffect(() => {
		void pushAnchors(false)
	}, [file, draft, isActive, focusedThreadId])

	useEffect(() => {
		const view = viewRef.current
		if (!revealRequest || !isActive || !view) return
		const range = useCommentsStore.getState().anchorRanges?.ranges[revealRequest.threadId]
		if (range) void revealCommentAnchor(view, range.from, range.to)
	}, [revealRequest, isActive, viewRef])

	const handleAnchorClick = useEffectEvent((threadId: string) => {
		if (threadId === DRAFT_THREAD_ID) return
		openCommentsPanel()
		useCommentsStore.getState().focusThread(threadId)
	})
	const getThreadPreview = useEffectEvent((threadId: string): CommentThreadPreview | null => {
		const thread = file.threads[threadId]
		if (!thread) return null
		const messages = sortedMessages(thread).filter((message) => message.deletedAt === null)
		const latest = messages.at(-1)
		if (!latest) return null
		const people = useMembersStore.getState().members.map(toCommentPerson)
		return {
			authorName: findCommentPerson(people, latest.authorId).name,
			body: latest.body.replace(MENTION_PATTERN, "@$1"),
			commentCount: messages.length,
			timeLabel: formatRelativeTime(latest.createdAt),
		}
	})
	const handleExternalDocChange = useEffectEvent(() => void pushAnchors(true))
	const handleLocalDocChange = useEffectEvent(() => {
		if (Object.keys(file.threads).length > 0) persistAnchors()
	})

	return useMemo<EditorExtensionFactory>(
		() => (runtime) =>
			commentsExtension(runtime, {
				onAnchorClick: (threadId) => handleAnchorClick(threadId),
				getThreadPreview: (threadId) => getThreadPreview(threadId),
				onExternalDocChange: () => handleExternalDocChange(),
				onViewReady: (view) => void pushAnchors(true, view),
				onLocalDocChange: () => handleLocalDocChange(),
			}),
		[],
	)
}
