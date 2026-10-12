import {
	addReply,
	addThread,
	type CommentAnchor,
	type CommentsFile,
	commentsSidecarPath,
	createCommentId,
	createEmptyCommentsFile,
	deleteMessage,
	editMessage,
	isCommentsFileEmpty,
	LOCAL_AUTHOR_ID,
	parseCommentsFile,
	type ResolvedAnchorRange,
	serializeCommentsFile,
	setResolved,
	updateAnchors,
} from "@cortex/comments"
import { getPlatform } from "@cortex/platform"
import { getVaultFilePath, toVaultRelativePath, VAULT_FILES } from "@cortex/platform/utils"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { useAuthStore } from "./authStore"
import { useRemoteVaultStore } from "./remoteVaultStore"

export interface CommentDraft {
	notePath: string
	anchor: CommentAnchor
}

export interface CommentAnchorRanges {
	notePath: string
	ranges: Record<string, ResolvedAnchorRange | null>
}

export interface CommentRevealRequest {
	threadId: string
	requestId: number
}

export interface CommentsState {
	vaultPath: string | null
	files: Record<string, CommentsFile>
	focusedThreadId: string | null
	focusRequestId: number
	draft: CommentDraft | null
	anchorRanges: CommentAnchorRanges | null
	revealRequest: CommentRevealRequest | null

	loadNoteComments: (vaultPath: string, notePath: string) => Promise<CommentsFile>
	reloadNoteComments: (
		vaultPath: string,
		notePath: string,
	) => Promise<{ previous: CommentsFile; next: CommentsFile }>
	createThread: (
		vaultPath: string,
		notePath: string,
		anchor: CommentAnchor,
		body: string,
		mentions: string[],
	) => Promise<string>
	replyToThread: (
		vaultPath: string,
		notePath: string,
		threadId: string,
		body: string,
		mentions: string[],
	) => Promise<void>
	setThreadResolved: (
		vaultPath: string,
		notePath: string,
		threadId: string,
		resolved: boolean,
	) => Promise<void>
	editComment: (
		vaultPath: string,
		notePath: string,
		threadId: string,
		messageId: string,
		body: string,
		mentions: string[],
	) => Promise<void>
	deleteComment: (
		vaultPath: string,
		notePath: string,
		threadId: string,
		messageId: string,
	) => Promise<void>
	saveAnchors: (
		vaultPath: string,
		notePath: string,
		anchors: ReadonlyMap<string, CommentAnchor>,
	) => Promise<void>
	moveNoteComments: (vaultPath: string, oldPath: string, newPath: string) => Promise<void>
	removeNoteComments: (vaultPath: string, notePath: string) => Promise<void>
	startDraft: (notePath: string, anchor: CommentAnchor) => void
	cancelDraft: () => void
	focusThread: (threadId: string | null, options?: { reveal?: boolean }) => void
	setAnchorRanges: (anchorRanges: CommentAnchorRanges) => void
}

const EMPTY_COMMENTS_FILE = createEmptyCommentsFile()
const writeQueues = new Map<string, Promise<unknown>>()

export function getCommentAuthorId(): string {
	const userId = useAuthStore.getState().user?.userId
	const remoteVaultId = useRemoteVaultStore.getState().syncConfig.remoteVaultId
	return remoteVaultId && userId ? userId : LOCAL_AUTHOR_ID
}

export function getNoteCommentsSidecarPath(vaultPath: string, notePath: string): string | null {
	const relativeNotePath = toVaultRelativePath(notePath, vaultPath)
	if (!relativeNotePath) return null
	return getVaultFilePath(vaultPath, commentsSidecarPath(relativeNotePath))
}

export function selectNoteComments(state: CommentsState, notePath: string | null): CommentsFile {
	return (notePath && state.files[notePath]) || EMPTY_COMMENTS_FILE
}

async function readSidecar(sidecarPath: string): Promise<CommentsFile> {
	try {
		return parseCommentsFile(await getPlatform().fs.readFile(sidecarPath))
	} catch {
		return createEmptyCommentsFile()
	}
}

async function writeSidecar(sidecarPath: string, file: CommentsFile): Promise<void> {
	const fs = getPlatform().fs
	if (!isCommentsFileEmpty(file)) {
		await fs.atomicWriteFile(sidecarPath, serializeCommentsFile(file))
		return
	}
	try {
		await fs.deleteFile(sidecarPath)
	} catch {}
}

function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
	const previous = writeQueues.get(key) ?? Promise.resolve()
	const next = previous.catch(() => undefined).then(task)
	writeQueues.set(key, next)
	void next.finally(() => {
		if (writeQueues.get(key) === next) writeQueues.delete(key)
	})
	return next
}

async function renameIfPresent(oldPath: string, newPath: string): Promise<void> {
	try {
		await getPlatform().fs.renameFile(oldPath, newPath)
	} catch {}
}

export const useCommentsStore = create<CommentsState>()(
	devtools(
		(set, get) => {
			const setNoteFile = (vaultPath: string, notePath: string, file: CommentsFile): void => {
				set((state) => ({
					vaultPath,
					files:
						state.vaultPath === vaultPath
							? { ...state.files, [notePath]: file }
							: { [notePath]: file },
				}))
			}

			const mutate = async (
				vaultPath: string,
				notePath: string,
				operation: (file: CommentsFile) => CommentsFile,
			): Promise<void> => {
				const sidecarPath = getNoteCommentsSidecarPath(vaultPath, notePath)
				if (!sidecarPath) return
				setNoteFile(vaultPath, notePath, operation(selectNoteComments(get(), notePath)))
				const persisted = await enqueue(sidecarPath, async () => {
					const next = operation(await readSidecar(sidecarPath))
					await writeSidecar(sidecarPath, next)
					return next
				})
				setNoteFile(vaultPath, notePath, persisted)
			}

			return {
				vaultPath: null,
				files: {},
				focusedThreadId: null,
				focusRequestId: 0,
				draft: null,
				anchorRanges: null,
				revealRequest: null,

				loadNoteComments: async (vaultPath, notePath) => {
					const sidecarPath = getNoteCommentsSidecarPath(vaultPath, notePath)
					if (!sidecarPath) return EMPTY_COMMENTS_FILE
					const file = await readSidecar(sidecarPath)
					setNoteFile(vaultPath, notePath, file)
					return file
				},

				reloadNoteComments: async (vaultPath, notePath) => {
					const previous = selectNoteComments(get(), notePath)
					const next = await get().loadNoteComments(vaultPath, notePath)
					return { previous, next }
				},

				createThread: async (vaultPath, notePath, anchor, body, mentions) => {
					const now = Date.now()
					const authorId = getCommentAuthorId()
					const threadId = createCommentId(now)
					const messageId = createCommentId(now)
					set({ draft: null, focusedThreadId: threadId })
					await mutate(vaultPath, notePath, (file) =>
						addThread(file, { anchor, authorId, body, mentions, now, threadId, id: messageId }),
					)
					return threadId
				},

				replyToThread: async (vaultPath, notePath, threadId, body, mentions) => {
					const now = Date.now()
					const authorId = getCommentAuthorId()
					const id = createCommentId(now)
					await mutate(vaultPath, notePath, (file) =>
						addReply(file, threadId, { authorId, body, mentions, now, id }),
					)
				},

				setThreadResolved: async (vaultPath, notePath, threadId, resolved) => {
					const now = Date.now()
					const actorId = getCommentAuthorId()
					await mutate(vaultPath, notePath, (file) =>
						setResolved(file, threadId, resolved, actorId, now),
					)
				},

				editComment: async (vaultPath, notePath, threadId, messageId, body, mentions) => {
					const now = Date.now()
					const actorId = getCommentAuthorId()
					await mutate(vaultPath, notePath, (file) =>
						editMessage(file, threadId, messageId, actorId, body, mentions, now),
					)
				},

				deleteComment: async (vaultPath, notePath, threadId, messageId) => {
					const now = Date.now()
					const actorId = getCommentAuthorId()
					await mutate(vaultPath, notePath, (file) =>
						deleteMessage(file, threadId, messageId, actorId, now),
					)
				},

				saveAnchors: async (vaultPath, notePath, anchors) => {
					const current = selectNoteComments(get(), notePath)
					if (updateAnchors(current, anchors) === current) return
					await mutate(vaultPath, notePath, (file) => updateAnchors(file, anchors))
				},

				moveNoteComments: async (vaultPath, oldPath, newPath) => {
					const oldRelative = toVaultRelativePath(oldPath, vaultPath)
					const newRelative = toVaultRelativePath(newPath, vaultPath)
					if (!oldRelative || !newRelative) return
					const commentsRoot = getVaultFilePath(vaultPath, VAULT_FILES.comments)
					await Promise.all([
						renameIfPresent(
							getVaultFilePath(vaultPath, commentsSidecarPath(oldRelative)),
							getVaultFilePath(vaultPath, commentsSidecarPath(newRelative)),
						),
						renameIfPresent(`${commentsRoot}/${oldRelative}`, `${commentsRoot}/${newRelative}`),
					])
					set((state) => {
						const files: Record<string, CommentsFile> = {}
						for (const [path, file] of Object.entries(state.files)) {
							const moved =
								path === oldPath
									? newPath
									: path.startsWith(`${oldPath}/`)
										? `${newPath}${path.slice(oldPath.length)}`
										: path
							files[moved] = file
						}
						return { files }
					})
				},

				removeNoteComments: async (vaultPath, notePath) => {
					const relativePath = toVaultRelativePath(notePath, vaultPath)
					if (!relativePath) return
					const fs = getPlatform().fs
					const commentsRoot = getVaultFilePath(vaultPath, VAULT_FILES.comments)
					await Promise.all(
						[
							getVaultFilePath(vaultPath, commentsSidecarPath(relativePath)),
							`${commentsRoot}/${relativePath}`,
						].map(async (path) => {
							try {
								await fs.deleteFile(path)
							} catch {}
						}),
					)
					set((state) => {
						const files = { ...state.files }
						for (const path of Object.keys(files)) {
							if (path === notePath || path.startsWith(`${notePath}/`)) delete files[path]
						}
						return { files }
					})
				},

				startDraft: (notePath, anchor) =>
					set({ draft: { notePath, anchor }, focusedThreadId: null }),
				cancelDraft: () => set({ draft: null }),
				focusThread: (threadId, options) =>
					set((state) => ({
						focusedThreadId: threadId,
						focusRequestId: state.focusRequestId + 1,
						revealRequest:
							threadId && options?.reveal
								? { threadId, requestId: (state.revealRequest?.requestId ?? 0) + 1 }
								: state.revealRequest,
					})),
				setAnchorRanges: (anchorRanges) => set({ anchorRanges }),
			}
		},
		{ name: "commentsStore" },
	),
)
