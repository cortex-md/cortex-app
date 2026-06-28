import type { CurrentUser, NoteSyncMetadata, VaultMember } from "@cortex/platform"

export interface NoteSyncAttribution {
	actorId: string
	displayName: string
	email: string | null
	editedAt: string
}

export interface LoadNoteSyncAttributionOptions {
	syncEnabled: boolean
	remoteVaultId: string | null
	vaultPath: string | null
	filePath: string
	currentUser: CurrentUser | null
	loadMetadata: (vaultPath: string, relativePath: string) => Promise<NoteSyncMetadata | null>
	loadMembers: (vaultId: string) => Promise<VaultMember[]>
}

function getDisplayName(displayName: string | null | undefined, email: string): string {
	return displayName?.trim() || email
}

export function resolveNoteSyncAttribution(
	metadata: NoteSyncMetadata | null,
	members: VaultMember[],
	currentUser: CurrentUser | null,
): NoteSyncAttribution | null {
	if (!metadata?.synced || !metadata.lastEditedAt || !metadata.lastEditedBy) return null

	const member = members.find((candidate) => candidate.userId === metadata.lastEditedBy)
	if (member) {
		return {
			actorId: member.userId,
			displayName: getDisplayName(member.displayName, member.email),
			email: member.email,
			editedAt: metadata.lastEditedAt,
		}
	}

	if (currentUser?.userId === metadata.lastEditedBy) {
		return {
			actorId: currentUser.userId,
			displayName: getDisplayName(currentUser.displayName, currentUser.email),
			email: currentUser.email,
			editedAt: metadata.lastEditedAt,
		}
	}

	return {
		actorId: metadata.lastEditedBy,
		displayName: "Unknown member",
		email: null,
		editedAt: metadata.lastEditedAt,
	}
}

export async function loadNoteSyncAttribution({
	syncEnabled,
	remoteVaultId,
	vaultPath,
	filePath,
	currentUser,
	loadMetadata,
	loadMembers,
}: LoadNoteSyncAttributionOptions): Promise<NoteSyncAttribution | null> {
	if (!syncEnabled || !remoteVaultId || !vaultPath || !filePath.startsWith(`${vaultPath}/`)) {
		return null
	}

	const relativePath = filePath.slice(vaultPath.length + 1)
	const metadata = await loadMetadata(vaultPath, relativePath)
	if (!metadata?.synced || !metadata.lastEditedAt || !metadata.lastEditedBy) return null

	const members = await loadMembers(remoteVaultId)
	return resolveNoteSyncAttribution(metadata, members, currentUser)
}

export function formatNoteEditedAt(editedAt: string, now: () => number = Date.now): string {
	const timestamp = new Date(editedAt).getTime()
	if (!Number.isFinite(timestamp)) return "at an unknown time"

	const elapsedMinutes = Math.floor(Math.max(0, now() - timestamp) / 60000)
	if (elapsedMinutes <= 0) return "just now"
	if (elapsedMinutes < 60) {
		return `${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`
	}

	const elapsedHours = Math.floor(elapsedMinutes / 60)
	if (elapsedHours < 24) {
		return `${elapsedHours} ${elapsedHours === 1 ? "hour" : "hours"} ago`
	}

	const elapsedDays = Math.floor(elapsedHours / 24)
	if (elapsedDays < 7) {
		return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`
	}

	return new Date(timestamp).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	})
}
