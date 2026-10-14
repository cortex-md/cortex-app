import { useAuthStore, useMembersStore, useRemoteVaultStore, useVaultStore } from "@cortex/core"
import type { VaultMember } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { getNoteTitle, toVaultRelativePath } from "@cortex/platform/utils"
import { useEffect, useSyncExternalStore } from "react"

import type { AvatarTint } from "@/components/ui/Avatar"
import type { CollabPendingInvite, CollabPerson, CollabRole } from "@/features/collab/collabTypes"

export interface CollabPresence {
	person: CollabPerson
	section: string
}

export interface CollabNoteSession {
	live: boolean
	presence: CollabPresence[]
	followingId: string | null
}

interface CollabStoreState {
	followingId: string | null
	pendingInvites: CollabPendingInvite[]
	linkSharing: Record<string, boolean>
}

const OVERVIEW_REFRESH_MS = 30_000
const MEMBER_TINTS: AvatarTint[] = ["accent", "blue", "green", "violet"]
const EMPTY_PRESENCE: CollabPresence[] = []

const listeners = new Set<() => void>()
let state: CollabStoreState = { followingId: null, pendingInvites: [], linkSharing: {} }
let lastOverview: { vaultId: string; at: number } | null = null

function setState(next: Partial<CollabStoreState>): void {
	state = { ...state, ...next }
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getState(): CollabStoreState {
	return state
}

function tintFor(id: string): AvatarTint {
	let hash = 0
	for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) | 0
	return MEMBER_TINTS[Math.abs(hash) % MEMBER_TINTS.length] ?? "accent"
}

function toRole(role: string): CollabRole {
	if (role === "owner" || role === "admin") return "Owner"
	if (role === "viewer") return "Viewer"
	return "Editor"
}

function currentUserId(): string | null {
	return useAuthStore.getState().user?.userId ?? null
}

function toPerson(member: VaultMember): CollabPerson {
	return {
		id: member.userId,
		name: member.displayName?.trim() || member.email,
		email: member.email,
		role: toRole(member.role),
		tint: tintFor(member.userId),
		isYou: member.userId === currentUserId(),
	}
}

function refreshOverview(): void {
	const vaultId = useRemoteVaultStore.getState().linkedVaultId
	if (!vaultId || !useAuthStore.getState().authenticated) return
	const now = Date.now()
	if (lastOverview?.vaultId === vaultId && now - lastOverview.at < OVERVIEW_REFRESH_MS) return
	lastOverview = { vaultId, at: now }
	void useMembersStore
		.getState()
		.fetchOverview(vaultId)
		.catch(() => undefined)
}

function presenceFor(
	filePath: string | null,
	presence: readonly { userId: string; filePath: string; canWrite: boolean }[],
) {
	const vaultPath = useVaultStore.getState().vault?.path
	const relativePath = filePath && vaultPath ? toVaultRelativePath(filePath, vaultPath) : null
	if (!relativePath) return EMPTY_PRESENCE
	const me = currentUserId()
	const members = useMembersStore.getState().members
	const peers = presence.filter((peer) => peer.filePath === relativePath && peer.userId !== me)
	if (peers.length === 0) return EMPTY_PRESENCE
	return peers.map((peer) => {
		const member = members.find((candidate) => candidate.userId === peer.userId)
		const person: CollabPerson = member
			? toPerson(member)
			: {
					id: peer.userId,
					name: "Someone",
					email: "",
					role: "Editor",
					tint: tintFor(peer.userId),
					isYou: false,
				}
		return { person, section: peer.canWrite ? "Editing" : "Viewing" }
	})
}

export function isLiveCollabNote(filePath: string | null): boolean {
	return presenceFor(filePath, useMembersStore.getState().presence).length > 0
}

export function getCollabVaultName(): string {
	return useVaultStore.getState().vault?.name ?? "this vault"
}

export function listVaultMembers(): CollabPerson[] {
	return useMembersStore.getState().members.map(toPerson)
}

export function listNotePeople(): CollabPerson[] {
	const members = listVaultMembers()
	return members.length > 0 ? members : [getCurrentPerson()]
}

export function getCurrentPerson(): CollabPerson {
	const user = useAuthStore.getState().user
	return {
		id: user?.userId ?? "local",
		name: user ? user.displayName?.trim() || user.email : "You",
		email: user?.email ?? "",
		role: "Owner",
		tint: "accent",
		isYou: true,
	}
}

export function getNoteDetail(filePath: string): string | null {
	const count = presenceFor(filePath, useMembersStore.getState().presence).length
	if (count === 0) return null
	return `${count} ${count === 1 ? "person" : "people"} editing`
}

export function useCollabNoteSession(filePath: string | null): CollabNoteSession {
	const followingId = useSyncExternalStore(subscribe, getState, getState).followingId
	const presence = useMembersStore((store) => store.presence)
	useMembersStore((store) => store.members)

	useEffect(() => {
		if (filePath) refreshOverview()
	}, [filePath])

	const entries = presenceFor(filePath, presence)
	const live = entries.length > 0
	return { live, presence: entries, followingId: live ? followingId : null }
}

export function followPerson(personId: string): void {
	setState({ followingId: personId })
}

export function stopFollowing(): void {
	setState({ followingId: null })
}

export function toggleFollow(personId: string): void {
	if (state.followingId === personId) stopFollowing()
	else followPerson(personId)
}

export function usePendingInvites(): CollabPendingInvite[] {
	return useSyncExternalStore(subscribe, getState, getState).pendingInvites
}

export function inviteToVault(email: string, role: CollabRole): CollabPendingInvite {
	// stub: invites go through useMembersStore.createInvite once the vault is linked remotely
	const invite: CollabPendingInvite = {
		id: `${Date.now()}-${email}`,
		email,
		role,
		expiresLabel: `${role} · Expires in 7 days`,
	}
	setState({ pendingInvites: [...state.pendingInvites, invite] })
	return invite
}

export function cancelInvite(inviteId: string): void {
	// stub: cancelling calls useMembersStore.deleteInvite when invites are remote
	setState({ pendingInvites: state.pendingInvites.filter((invite) => invite.id !== inviteId) })
}

export function useLinkSharing(filePath: string | null): boolean {
	const linkSharing = useSyncExternalStore(subscribe, getState, getState).linkSharing
	return filePath ? Boolean(linkSharing[filePath]) : false
}

export function setLinkSharing(filePath: string, enabled: boolean): void {
	// stub: link sharing is a local flag until note share links come from the sync server
	setState({ linkSharing: { ...state.linkSharing, [filePath]: enabled } })
}

export async function copyNoteLink(filePath: string): Promise<void> {
	// stub: the share link points at the note title until the sync server issues real share links
	await getPlatform().clipboard.writeText(
		`cortex://open?note=${encodeURIComponent(getNoteTitle(filePath))}`,
	)
}
