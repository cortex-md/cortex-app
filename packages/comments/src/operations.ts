import {
	COMMENTS_FILE_VERSION,
	type CommentAnchor,
	type CommentMessage,
	type CommentsFile,
	type CommentThread,
	type IncomingCommentMessage,
	type ResolvedAnchorRange,
} from "./types"

export interface NewMessageInput {
	authorId: string
	body: string
	mentions: string[]
	now: number
	id?: string
}

export interface NewThreadInput extends NewMessageInput {
	anchor: CommentAnchor
	threadId?: string
}

let idCounter = 0

export function createCommentId(now = Date.now()): string {
	idCounter = (idCounter + 1) % 1_679_616
	const random = Math.floor(Math.random() * 2_176_782_336).toString(36)
	return `${now.toString(36)}${idCounter.toString(36).padStart(4, "0")}${random.padStart(6, "0")}`
}

export function createEmptyCommentsFile(): CommentsFile {
	return { version: COMMENTS_FILE_VERSION, threads: {} }
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback
}

function readNumber(value: unknown, fallback = 0): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function readNullableNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null
}

function normalizeAnchor(value: unknown): CommentAnchor | null {
	if (!isRecord(value)) return null
	const quote = readString(value.quote)
	if (!quote) return null
	const from = Math.max(0, readNumber(value.from))
	return {
		quote,
		prefix: readString(value.prefix),
		suffix: readString(value.suffix),
		from,
		to: Math.max(from, readNumber(value.to, from + quote.length)),
	}
}

function normalizeMessage(id: string, value: unknown): CommentMessage | null {
	if (!isRecord(value)) return null
	const authorId = readString(value.authorId)
	if (!authorId) return null
	return {
		id,
		authorId,
		body: readString(value.body),
		mentions: Array.isArray(value.mentions)
			? value.mentions.filter((mention): mention is string => typeof mention === "string")
			: [],
		createdAt: readNumber(value.createdAt),
		editedAt: readNullableNumber(value.editedAt),
		deletedAt: readNullableNumber(value.deletedAt),
	}
}

function normalizeThread(id: string, value: unknown): CommentThread | null {
	if (!isRecord(value)) return null
	const anchor = normalizeAnchor(value.anchor)
	if (!anchor) return null
	const messages: Record<string, CommentMessage> = {}
	if (isRecord(value.messages)) {
		for (const [messageId, rawMessage] of Object.entries(value.messages)) {
			const message = normalizeMessage(messageId, rawMessage)
			if (message) messages[messageId] = message
		}
	}
	if (Object.keys(messages).length === 0) return null
	return {
		id,
		anchor,
		createdAt: readNumber(value.createdAt),
		createdBy: readString(value.createdBy),
		resolvedAt: readNullableNumber(value.resolvedAt),
		resolvedBy: typeof value.resolvedBy === "string" ? value.resolvedBy : null,
		messages,
	}
}

export function normalizeCommentsFile(value: unknown): CommentsFile {
	const file = createEmptyCommentsFile()
	if (!isRecord(value) || !isRecord(value.threads)) return file
	for (const [threadId, rawThread] of Object.entries(value.threads)) {
		const thread = normalizeThread(threadId, rawThread)
		if (thread) file.threads[threadId] = thread
	}
	return file
}

export function parseCommentsFile(content: string | null | undefined): CommentsFile {
	if (!content?.trim()) return createEmptyCommentsFile()
	try {
		return normalizeCommentsFile(JSON.parse(content))
	} catch {
		return createEmptyCommentsFile()
	}
}

export function serializeCommentsFile(file: CommentsFile): string {
	return `${JSON.stringify(file, null, "\t")}\n`
}

export function isCommentsFileEmpty(file: CommentsFile): boolean {
	return Object.keys(file.threads).length === 0
}

function createMessage(input: NewMessageInput): CommentMessage {
	return {
		id: input.id ?? createCommentId(input.now),
		authorId: input.authorId,
		body: input.body.trim(),
		mentions: [...new Set(input.mentions)],
		createdAt: input.now,
		editedAt: null,
		deletedAt: null,
	}
}

function updateThread(
	file: CommentsFile,
	threadId: string,
	update: (thread: CommentThread) => CommentThread,
): CommentsFile {
	const thread = file.threads[threadId]
	if (!thread) return file
	return { ...file, threads: { ...file.threads, [threadId]: update(thread) } }
}

export function addThread(file: CommentsFile, input: NewThreadInput): CommentsFile {
	const threadId = input.threadId ?? createCommentId(input.now)
	const message = createMessage(input)
	const thread: CommentThread = {
		id: threadId,
		anchor: input.anchor,
		createdAt: input.now,
		createdBy: input.authorId,
		resolvedAt: null,
		resolvedBy: null,
		messages: { [message.id]: message },
	}
	return { ...file, threads: { ...file.threads, [threadId]: thread } }
}

export function addReply(
	file: CommentsFile,
	threadId: string,
	input: NewMessageInput,
): CommentsFile {
	const message = createMessage(input)
	return updateThread(file, threadId, (thread) => ({
		...thread,
		resolvedAt: null,
		resolvedBy: null,
		messages: { ...thread.messages, [message.id]: message },
	}))
}

export function setResolved(
	file: CommentsFile,
	threadId: string,
	resolved: boolean,
	actorId: string,
	now: number,
): CommentsFile {
	return updateThread(file, threadId, (thread) => ({
		...thread,
		resolvedAt: resolved ? now : null,
		resolvedBy: resolved ? actorId : null,
	}))
}

function updateMessage(
	file: CommentsFile,
	threadId: string,
	messageId: string,
	actorId: string,
	update: (message: CommentMessage) => CommentMessage,
): CommentsFile {
	return updateThread(file, threadId, (thread) => {
		const message = thread.messages[messageId]
		if (!message || message.authorId !== actorId || message.deletedAt !== null) return thread
		return { ...thread, messages: { ...thread.messages, [messageId]: update(message) } }
	})
}

export function editMessage(
	file: CommentsFile,
	threadId: string,
	messageId: string,
	actorId: string,
	body: string,
	mentions: string[],
	now: number,
): CommentsFile {
	return updateMessage(file, threadId, messageId, actorId, (message) => ({
		...message,
		body: body.trim(),
		mentions: [...new Set(mentions)],
		editedAt: now,
	}))
}

export function deleteMessage(
	file: CommentsFile,
	threadId: string,
	messageId: string,
	actorId: string,
	now: number,
): CommentsFile {
	const next = updateMessage(file, threadId, messageId, actorId, (message) => ({
		...message,
		body: "",
		mentions: [],
		deletedAt: now,
	}))
	const thread = next.threads[threadId]
	if (!thread || Object.values(thread.messages).some((message) => message.deletedAt === null)) {
		return next
	}
	const { [threadId]: _removed, ...threads } = next.threads
	return { ...next, threads }
}

export function deleteThread(file: CommentsFile, threadId: string): CommentsFile {
	if (!file.threads[threadId]) return file
	const { [threadId]: _removed, ...threads } = file.threads
	return { ...file, threads }
}

export function updateAnchors(
	file: CommentsFile,
	anchors: ReadonlyMap<string, CommentAnchor>,
): CommentsFile {
	let changed = false
	const threads = { ...file.threads }
	for (const [threadId, anchor] of anchors) {
		const thread = threads[threadId]
		if (!thread || thread.anchor === anchor) continue
		if (
			thread.anchor.from === anchor.from &&
			thread.anchor.to === anchor.to &&
			thread.anchor.quote === anchor.quote
		) {
			continue
		}
		threads[threadId] = { ...thread, anchor }
		changed = true
	}
	return changed ? { ...file, threads } : file
}

export function sortedMessages(thread: CommentThread): CommentMessage[] {
	return Object.values(thread.messages).sort(
		(left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id),
	)
}

export function sortThreadsByPosition(
	threads: Iterable<CommentThread>,
	ranges: ReadonlyMap<string, ResolvedAnchorRange | null>,
): CommentThread[] {
	return [...threads].sort((left, right) => {
		const leftRange = ranges.get(left.id)
		const rightRange = ranges.get(right.id)
		if (leftRange && !rightRange) return -1
		if (!leftRange && rightRange) return 1
		if (leftRange && rightRange && leftRange.from !== rightRange.from) {
			return leftRange.from - rightRange.from
		}
		return left.createdAt - right.createdAt
	})
}

export function openThreadCount(file: CommentsFile): number {
	let count = 0
	for (const thread of Object.values(file.threads)) if (thread.resolvedAt === null) count += 1
	return count
}

export function threadParticipants(thread: CommentThread): Set<string> {
	const participants = new Set<string>([thread.createdBy])
	for (const message of Object.values(thread.messages)) participants.add(message.authorId)
	return participants
}

export function diffIncomingMessages(
	previous: CommentsFile,
	next: CommentsFile,
	currentUserId: string,
): IncomingCommentMessage[] {
	const incoming: IncomingCommentMessage[] = []
	for (const thread of Object.values(next.threads)) {
		const previousThread = previous.threads[thread.id]
		const wasParticipant = previousThread
			? threadParticipants(previousThread).has(currentUserId)
			: false
		for (const message of sortedMessages(thread)) {
			if (previousThread?.messages[message.id]) continue
			if (message.authorId === currentUserId || message.deletedAt !== null) continue
			if (message.mentions.includes(currentUserId)) {
				incoming.push({ threadId: thread.id, message, reason: "mention" })
			} else if (wasParticipant) {
				incoming.push({ threadId: thread.id, message, reason: "reply" })
			}
		}
	}
	return incoming
}
