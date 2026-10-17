import {
	getErrorMessage,
	useAuthStore,
	useMembersStore,
	useNoteSharesStore,
	useRemoteVaultStore,
	useVaultStore,
} from "@cortex/core"
import type { VaultMember } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { toVaultRelativePath } from "@cortex/platform/utils"
import { useEffect, useSyncExternalStore } from "react"

import type { AvatarTint } from "@/components/ui/Avatar"
import type { CollabPendingInvite, CollabPerson, CollabRole } from "@/features/collab/collabTypes"
import { buildSharedNoteBundle } from "@/features/collab/noteShareBundle"
import { toast } from "@/features/feedback/useToast"

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
}

const OVERVIEW_REFRESH_MS = 30_000
const MEMBER_TINTS: AvatarTint[] = ["accent", "blue", "green", "violet"]
const EMPTY_PRESENCE: CollabPresence[] = []

const listeners = new Set<() => void>()
let state: CollabStoreState = { followingId: null }
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
	if (role === "guest") return "Guest"
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

function toCollabRole(role: string): CollabRole {
	return toRole(role)
}

function toServerRole(role: CollabRole): string {
	if (role === "Owner") return "admin"
	if (role === "Guest") return "guest"
	return role === "Viewer" ? "viewer" : "editor"
}

function inviteExpiry(expiresAt: string): string {
	const remaining = new Date(expiresAt).getTime() - Date.now()
	if (Number.isNaN(remaining) || remaining <= 0) return "Expired"
	const days = Math.max(1, Math.ceil(remaining / 86_400_000))
	return `Expires in ${days} ${days === 1 ? "day" : "days"}`
}

const EMPTY_INVITES: CollabPendingInvite[] = []

export function usePendingInvites(): CollabPendingInvite[] {
	const vaultId = useRemoteVaultStore((store) => store.linkedVaultId)
	const invites = useMembersStore((store) => store.invites)

	useEffect(() => {
		if (!vaultId) return
		void useMembersStore
			.getState()
			.fetchInvites(vaultId)
			.catch(() => undefined)
	}, [vaultId])

	if (invites.length === 0) return EMPTY_INVITES
	return invites
		.filter((invite) => !invite.accepted)
		.map((invite) => {
			const role = toCollabRole(invite.role)
			return {
				id: invite.id,
				email: invite.inviteeEmail,
				role,
				expiresLabel: `${role} · ${inviteExpiry(invite.expiresAt)}`,
			}
		})
}

async function withLinkedVault(task: (vaultId: string) => Promise<void>): Promise<boolean> {
	const vaultId = useRemoteVaultStore.getState().linkedVaultId
	if (!vaultId) {
		toast("Link this vault to share it")
		return false
	}
	try {
		await task(vaultId)
		return true
	} catch (error) {
		toast(getErrorMessage(error))
		return false
	}
}

export function inviteToVault(
	email: string,
	role: CollabRole,
	filePath: string | null = null,
): Promise<boolean> {
	return withLinkedVault(async (vaultId) => {
		const notePath = role === "Guest" && filePath ? notePathFor(filePath) : null
		if (role === "Guest" && !notePath) throw new Error("Open a note to invite a guest to it.")
		await useMembersStore
			.getState()
			.createInvite(
				vaultId,
				email,
				toServerRole(role),
				"",
				notePath ? { grants: [{ path: notePath, canWrite: true }] } : undefined,
			)
	})
}

export function cancelInvite(inviteId: string): void {
	void withLinkedVault((vaultId) => useMembersStore.getState().deleteInvite(vaultId, inviteId))
}

function notePathFor(filePath: string): string | null {
	const vaultPath = useVaultStore.getState().vault?.path
	return vaultPath ? toVaultRelativePath(filePath, vaultPath) : null
}

export function useLinkSharing(filePath: string | null): boolean {
	const vaultId = useRemoteVaultStore((store) => store.linkedVaultId)
	const notePath = filePath ? notePathFor(filePath) : null
	const shared = useNoteSharesStore((store) =>
		notePath ? Boolean(store.sharesByPath[notePath]) : false,
	)

	useEffect(() => {
		if (!vaultId) return
		void useNoteSharesStore
			.getState()
			.fetchShares(vaultId)
			.catch(() => undefined)
	}, [vaultId])

	return shared
}

export function setLinkSharing(filePath: string, enabled: boolean): Promise<boolean> {
	const notePath = notePathFor(filePath)
	if (!notePath) return Promise.resolve(false)
	return withLinkedVault(async (vaultId) => {
		const store = useNoteSharesStore.getState()
		if (enabled) {
			await store.publish(vaultId, notePath, await buildSharedNoteBundle(filePath))
			return
		}
		const share = store.sharesByPath[notePath]
		if (share) await store.revoke(vaultId, share.id)
	})
}

export async function copyNoteLink(filePath: string): Promise<boolean> {
	const notePath = notePathFor(filePath)
	const link = notePath ? useNoteSharesStore.getState().sharesByPath[notePath]?.link : null
	if (!link) {
		toast("Turn on link sharing first")
		return false
	}
	await getPlatform().clipboard.writeText(link)
	return true
}
