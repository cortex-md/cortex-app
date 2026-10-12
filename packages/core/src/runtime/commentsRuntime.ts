import {
	diffIncomingMessages,
	extractMentions,
	type IncomingCommentMessage,
	isMentionedBy,
	MENTION_PATTERN,
	type MentionCandidate,
	notePathFromSidecar,
	resolveMentionTargets,
} from "@cortex/comments"
import { getPlatform, type NotificationActivation, type VaultMember } from "@cortex/platform"
import {
	getBaseName,
	getVaultFilePath,
	normalizePath,
	toVaultRelativePath,
	VAULT_FILES,
} from "@cortex/platform/utils"
import { useSettingsStore } from "@cortex/settings"
import { deferForQuietHours } from "@cortex/tasks"
import { useAuthStore } from "../stores/authStore"
import { getCommentAuthorId, useCommentsStore } from "../stores/commentsStore"
import { useMembersStore } from "../stores/membersStore"
import { useUIStore } from "../stores/uiStore"
import { useVaultStore } from "../stores/vaultStore"
import { useWorkspaceStore } from "../stores/workspaceStore"

const SYNC_APPLIED_STATUSES = new Set(["synced", "merged"])
const COMMENT_NOTIFICATION_KIND = "comment"
const NOTIFICATION_PREVIEW_LENGTH = 140
const SIDECAR_RELOAD_DELAY_MS = 120

export function toMentionCandidates(members: readonly VaultMember[]): MentionCandidate[] {
	return members.map((member) => ({
		userId: member.userId,
		name: member.displayName || member.email,
	}))
}

export function resolveCommentMentions(body: string): string[] {
	return resolveMentionTargets(
		extractMentions(body),
		toMentionCandidates(useMembersStore.getState().members),
	)
}

function memberName(userId: string): string {
	const member = useMembersStore.getState().members.find((entry) => entry.userId === userId)
	return member?.displayName || member?.email || "Someone"
}

function previewText(body: string): string {
	const plain = body.replace(MENTION_PATTERN, "@$1").replace(/\s+/g, " ").trim()
	return plain.length > NOTIFICATION_PREVIEW_LENGTH
		? `${plain.slice(0, NOTIFICATION_PREVIEW_LENGTH - 1)}…`
		: plain
}

function noteTitle(notePath: string): string {
	return getBaseName(notePath).replace(/\.md$/i, "")
}

function canNotify(): boolean {
	const settings = useSettingsStore.getState().settings.tasks
	if (!settings.mentionsEnabled) return false
	const now = new Date()
	const quietHours = {
		enabled: settings.quietHoursEnabled,
		start: settings.quietHoursStart,
		end: settings.quietHoursEnd,
	}
	return deferForQuietHours(now, quietHours).getTime() === now.getTime()
}

function notify(
	vaultPath: string,
	notePath: string,
	threadId: string | null,
	notificationId: string,
	title: string,
	body: string,
): void {
	const notifications = getPlatform().notifications
	if (!notifications.getCapabilities().supported || !canNotify()) return
	const settings = useSettingsStore.getState().settings.tasks
	void notifications
		.send({
			id: notificationId,
			title,
			body,
			tag: threadId ?? notePath,
			silent: !settings.sound,
			source: "core",
			activationScope: vaultPath,
			metadata: { kind: COMMENT_NOTIFICATION_KIND, notePath, threadId },
			...(threadId ? { reply: { placeholder: "Reply…" } } : {}),
		})
		.catch((error) => console.warn("[comments] failed to send notification:", error))
}

function notifyIncomingMessages(
	vaultPath: string,
	notePath: string,
	messages: IncomingCommentMessage[],
): void {
	for (const { threadId, message, reason } of messages) {
		const author = memberName(message.authorId)
		notify(
			vaultPath,
			notePath,
			threadId,
			`comment-${message.id}`,
			reason === "mention" ? `${author} mentioned you` : `${author} replied`,
			`“${previewText(message.body)}” in ${noteTitle(notePath)}`,
		)
	}
}

function toVaultRelative(vaultPath: string, path: string): string {
	const normalized = normalizePath(path)
	return toVaultRelativePath(normalized, vaultPath) ?? normalized.replace(/^\/+/, "")
}

async function handleActivation(activation: NotificationActivation): Promise<void> {
	const payload = activation.payload
	const vault = useVaultStore.getState().vault
	if (payload?.kind !== COMMENT_NOTIFICATION_KIND || !vault || activation.scope !== vault.path) {
		return
	}
	const notePath = typeof payload.notePath === "string" ? payload.notePath : null
	const threadId = typeof payload.threadId === "string" ? payload.threadId : null
	if (!notePath) return
	const comments = useCommentsStore.getState()
	if (activation.actionId === "reply" && threadId && activation.reply?.trim()) {
		await comments.loadNoteComments(vault.path, notePath)
		await comments.replyToThread(
			vault.path,
			notePath,
			threadId,
			activation.reply,
			resolveCommentMentions(activation.reply),
		)
		return
	}
	if (activation.actionId !== null) return
	useWorkspaceStore.getState().openTab(notePath)
	if (!threadId) return
	useUIStore.getState().setRightSidebarLayout({ collapsed: false, panel: "comments" })
	await comments.loadNoteComments(vault.path, notePath)
	comments.focusThread(threadId)
}

export function startCommentsRuntime(): () => void {
	const platform = getPlatform()
	const startedAt = Date.now()
	const bodyMentionState = new Map<string, boolean>()

	const handleSidecarChange = async (vaultPath: string, relativeSidecarPath: string) => {
		const relativeNotePath = notePathFromSidecar(relativeSidecarPath)
		if (!relativeNotePath) return
		const notePath = getVaultFilePath(vaultPath, relativeNotePath)
		const { previous, next } = await useCommentsStore
			.getState()
			.reloadNoteComments(vaultPath, notePath)
		const currentUserId = getCommentAuthorId()
		const incoming = diffIncomingMessages(previous, next, currentUserId).filter(
			({ message }) => message.createdAt >= startedAt,
		)
		notifyIncomingMessages(vaultPath, notePath, incoming)
	}

	const handleNoteChange = async (vaultPath: string, relativeNotePath: string) => {
		const user = useAuthStore.getState().user
		const displayName = user?.displayName || user?.email
		if (!displayName) return
		const notePath = getVaultFilePath(vaultPath, relativeNotePath)
		const [content, metadata] = await Promise.all([
			platform.fs.readFile(notePath),
			platform.fs.getFileMetadata(notePath).catch(() => null),
		])
		const mentioned = isMentionedBy(content, displayName)
		const known = bodyMentionState.get(notePath)
		bodyMentionState.set(notePath, mentioned)
		const wasMentioned = known ?? !(metadata && metadata.createdAt >= startedAt)
		if (!mentioned || wasMentioned) return
		notify(
			vaultPath,
			notePath,
			null,
			`mention-${notePath}-${Date.now()}`,
			"You were mentioned",
			`in ${noteTitle(notePath)}`,
		)
	}

	const unsubscribeSyncEvents = platform.sync?.onFileEvent?.((event) => {
		const vault = useVaultStore.getState().vault
		if (!vault || !SYNC_APPLIED_STATUSES.has(event.status) || !event.path) return
		const relativePath = toVaultRelative(vault.path, event.path)
		if (notePathFromSidecar(relativePath)) {
			scheduleSidecarReload(vault.path, relativePath)
			return
		}
		const task = /\.md$/i.test(relativePath) ? handleNoteChange(vault.path, relativePath) : null
		task?.catch((error) => console.warn("[comments] failed to process sync event:", error))
	})

	const pendingSidecarReloads = new Map<string, ReturnType<typeof setTimeout>>()
	let stopSidecarWatcher: (() => void) | null = null
	let watchedVaultPath: string | null = null

	const scheduleSidecarReload = (vaultPath: string, relativeSidecarPath: string) => {
		const pending = pendingSidecarReloads.get(relativeSidecarPath)
		if (pending) clearTimeout(pending)
		pendingSidecarReloads.set(
			relativeSidecarPath,
			setTimeout(() => {
				pendingSidecarReloads.delete(relativeSidecarPath)
				if (useVaultStore.getState().vault?.path !== vaultPath) return
				handleSidecarChange(vaultPath, relativeSidecarPath).catch((error) =>
					console.warn("[comments] failed to reload comments:", error),
				)
			}, SIDECAR_RELOAD_DELAY_MS),
		)
	}

	const watchSidecars = async (vaultPath: string | null) => {
		if (vaultPath === watchedVaultPath) return
		watchedVaultPath = vaultPath
		stopSidecarWatcher?.()
		stopSidecarWatcher = null
		if (!vaultPath) return
		const commentsDirectory = getVaultFilePath(vaultPath, VAULT_FILES.comments)
		try {
			await platform.fs.createDir(commentsDirectory)
			const stop = await platform.fs.startWatching(
				commentsDirectory,
				(event) => {
					const relativePath = toVaultRelative(vaultPath, event.path)
					if (notePathFromSidecar(relativePath)) scheduleSidecarReload(vaultPath, relativePath)
				},
				{ includeHidden: true },
			)
			if (watchedVaultPath === vaultPath) stopSidecarWatcher = stop
			else stop()
		} catch (error) {
			console.warn("[comments] failed to watch comments:", error)
		}
	}

	void watchSidecars(useVaultStore.getState().vault?.path ?? null)
	const unsubscribeVault = useVaultStore.subscribe((state, previousState) => {
		if (state.vault?.path !== previousState.vault?.path) {
			void watchSidecars(state.vault?.path ?? null)
		}
	})

	const unsubscribeActivation = platform.notifications.onActivation?.((activation) => {
		handleActivation(activation).catch((error) =>
			console.warn("[comments] failed to handle notification action:", error),
		)
	})

	return () => {
		unsubscribeSyncEvents?.()
		unsubscribeActivation?.()
		unsubscribeVault()
		void watchSidecars(null)
		for (const pending of pendingSidecarReloads.values()) clearTimeout(pending)
		pendingSidecarReloads.clear()
	}
}
