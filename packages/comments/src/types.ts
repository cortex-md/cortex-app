export const COMMENTS_FILE_VERSION = 1

export const LOCAL_AUTHOR_ID = "local"

export interface CommentAnchor {
	quote: string
	prefix: string
	suffix: string
	from: number
	to: number
}

export interface CommentMessage {
	id: string
	authorId: string
	body: string
	mentions: string[]
	createdAt: number
	editedAt: number | null
	deletedAt: number | null
}

export interface CommentThread {
	id: string
	anchor: CommentAnchor
	createdAt: number
	createdBy: string
	resolvedAt: number | null
	resolvedBy: string | null
	messages: Record<string, CommentMessage>
}

export interface CommentsFile {
	version: typeof COMMENTS_FILE_VERSION
	threads: Record<string, CommentThread>
}

export interface ResolvedAnchorRange {
	from: number
	to: number
}

export interface MentionCandidate {
	userId: string
	name: string
}

export interface IncomingCommentMessage {
	threadId: string
	message: CommentMessage
	reason: "mention" | "reply"
}
