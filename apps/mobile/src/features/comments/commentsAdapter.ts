import {
	getErrorMessage,
	resolveCommentMentions,
	selectNoteComments,
	useCommentsStore,
	useMembersStore,
	useVaultStore,
} from "@cortex/core"
import { useEffect, useMemo } from "react"

import type { AvatarTint } from "@/components/ui/Avatar"
import { getCurrentPerson, listNotePeople } from "@/features/collab/collabAdapter"
import type { CollabPerson } from "@/features/collab/collabTypes"
import { toast } from "@/features/feedback/useToast"

type CommentsFile = ReturnType<typeof selectNoteComments>
type StoredThread = CommentsFile["threads"][string]

export interface CommentMessageView {
	id: string
	authorName: string
	authorTint: AvatarTint
	timeLabel: string
	body: string
}

export interface CommentThreadView {
	id: string
	quote: string
	resolved: boolean
	createdAt: number
	messages: CommentMessageView[]
}

const MENTION_TOKEN = /@\[\[([^\]\n]+)\]\]/g
const LOCAL_AUTHOR_ID = "local"
const MINUTE_MS = 60_000

export function formatCommentTime(timestamp: number, now = Date.now()): string {
	const minutes = Math.floor((now - timestamp) / MINUTE_MS)
	if (minutes <= 0) return "Just now"
	if (minutes < 60) return `${minutes} min ago`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours} h ago`
	return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function splitCommentMentions(body: string): { text: string; mention: boolean }[] {
	const segments: { text: string; mention: boolean }[] = []
	let cursor = 0
	for (const match of body.matchAll(MENTION_TOKEN)) {
		const start = match.index ?? 0
		if (start > cursor) segments.push({ text: body.slice(cursor, start), mention: false })
		segments.push({ text: `@${match[1]?.trim() ?? ""}`, mention: true })
		cursor = start + match[0].length
	}
	if (cursor < body.length) segments.push({ text: body.slice(cursor), mention: false })
	return segments
}

export function encodeCommentMentions(draft: string, people: readonly CollabPerson[]): string {
	return [...people]
		.sort((left, right) => right.name.length - left.name.length)
		.reduce((body, person) => body.split(`@${person.name}`).join(`@[[${person.name}]]`), draft)
}

function resolveAuthor(authorId: string): { name: string; tint: AvatarTint } {
	const you = getCurrentPerson()
	if (authorId === LOCAL_AUTHOR_ID || authorId === you.id) return { name: you.name, tint: you.tint }
	const member = useMembersStore.getState().members.find((entry) => entry.userId === authorId)
	return { name: member?.displayName || member?.email || "Someone", tint: "blue" }
}

function toThreadView(thread: StoredThread): CommentThreadView {
	const messages = Object.values(thread.messages)
		.filter((message) => message.deletedAt === null)
		.sort((left, right) => left.createdAt - right.createdAt)
		.map((message) => {
			const author = resolveAuthor(message.authorId)
			return {
				id: message.id,
				authorName: author.name,
				authorTint: author.tint,
				timeLabel: formatCommentTime(message.createdAt),
				body: message.body,
			}
		})
	return {
		id: thread.id,
		quote: thread.anchor.quote,
		resolved: thread.resolvedAt !== null,
		createdAt: thread.createdAt,
		messages,
	}
}

export function useNoteThreads(filePath: string | null): CommentThreadView[] {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const file = useCommentsStore((state) => selectNoteComments(state, filePath))

	useEffect(() => {
		if (!vaultPath || !filePath) return
		void useCommentsStore.getState().loadNoteComments(vaultPath, filePath)
	}, [filePath, vaultPath])

	return useMemo(
		() =>
			Object.values(file.threads)
				.map(toThreadView)
				.sort((left, right) => left.createdAt - right.createdAt),
		[file],
	)
}

export function useOpenCommentCount(filePath: string | null): number {
	return useNoteThreads(filePath).filter((thread) => !thread.resolved).length
}

export async function setCommentThreadResolved(
	filePath: string,
	threadId: string,
	resolved: boolean,
): Promise<void> {
	const vaultPath = useVaultStore.getState().vault?.path
	if (!vaultPath) return
	try {
		await useCommentsStore.getState().setThreadResolved(vaultPath, filePath, threadId, resolved)
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

export async function replyToCommentThread(
	filePath: string,
	threadId: string,
	draft: string,
): Promise<void> {
	const body = encodeCommentMentions(draft.trim(), listNotePeople())
	if (!body) return
	const vaultPath = useVaultStore.getState().vault?.path
	if (!vaultPath) return
	try {
		await useCommentsStore
			.getState()
			.replyToThread(vaultPath, filePath, threadId, body, resolveCommentMentions(body))
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

export function listMentionCandidates(): CollabPerson[] {
	return listNotePeople().filter((person) => !person.isYou)
}
