import { useMembersStore, useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { getNoteTitle } from "@cortex/platform/utils"
import { useSyncExternalStore } from "react"

import type { AvatarTint } from "@/components/ui/Avatar"
import {
	type CollabPendingInvite,
	type CollabPerson,
	type CollabPresenceEntry,
	type CollabRole,
	FIXTURE_LAST_EDITOR,
	FIXTURE_LIVE_NOTE_TITLE,
	FIXTURE_LIVE_PRESENCE,
	FIXTURE_PEOPLE,
	FIXTURE_VAULT_MEMBERS,
	FIXTURE_VAULT_NAME,
} from "@/features/collab/collabFixtures"

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

const listeners = new Set<() => void>()
let state: CollabStoreState = { followingId: null, pendingInvites: [], linkSharing: {} }

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

const memberTints: AvatarTint[] = ["accent", "blue", "green", "violet"]

function personById(id: string): CollabPerson {
	return FIXTURE_PEOPLE.find((person) => person.id === id) ?? FIXTURE_PEOPLE[0]
}

export function isLiveCollabNote(filePath: string | null): boolean {
	// stub: live sessions come from @cortex/collab rooms once the sync transport runs on mobile
	return filePath !== null && getNoteTitle(filePath) === FIXTURE_LIVE_NOTE_TITLE
}

export function getCollabVaultName(): string {
	return useVaultStore.getState().vault?.name ?? FIXTURE_VAULT_NAME
}

export function listVaultMembers(): CollabPerson[] {
	// stub: remote members are read from useMembersStore when the vault is linked, fixtures otherwise
	const members = useMembersStore.getState().members
	if (members.length === 0) return FIXTURE_VAULT_MEMBERS
	return members.map((member, index) => ({
		id: member.userId,
		name: member.displayName || member.email,
		email: member.email,
		role: (member.role.charAt(0).toUpperCase() + member.role.slice(1)) as CollabRole,
		tint: memberTints[index % memberTints.length],
		isYou: index === 0,
	}))
}

export function listNotePeople(): CollabPerson[] {
	// stub: people with access to a note are the vault members of the fixture session
	return FIXTURE_PEOPLE
}

export function getCurrentPerson(): CollabPerson {
	// stub: the signed-in account maps to the first fixture person until auth runs on mobile
	return FIXTURE_PEOPLE[0]
}

export function getNoteAttribution(filePath: string | null): {
	person: CollabPerson
	label: string
} | null {
	// stub: last editor attribution comes from the sync metadata once it exists on mobile
	if (!filePath) return null
	return { person: personById(FIXTURE_LAST_EDITOR.personId), label: FIXTURE_LAST_EDITOR.label }
}

export function getNoteDetail(filePath: string): string | null {
	// stub: the "people editing" detail reflects the fixture live session only
	if (!isLiveCollabNote(filePath)) return null
	return `${FIXTURE_LIVE_PRESENCE.length} people editing`
}

function presenceEntries(entries: CollabPresenceEntry[]): CollabPresence[] {
	return entries.map((entry) => ({ person: personById(entry.personId), section: entry.section }))
}

const EMPTY_PRESENCE: CollabPresence[] = []
const livePresence = presenceEntries(FIXTURE_LIVE_PRESENCE)

export function getCollabNoteSession(filePath: string | null): CollabNoteSession {
	// stub: presence and follow state are local fixtures until collab awareness is bridged
	const live = isLiveCollabNote(filePath)
	return {
		live,
		presence: live ? livePresence : EMPTY_PRESENCE,
		followingId: live ? state.followingId : null,
	}
}

export function useCollabNoteSession(filePath: string | null): CollabNoteSession {
	const followingId = useSyncExternalStore(subscribe, getState, getState).followingId
	const live = isLiveCollabNote(filePath)
	return {
		live,
		presence: live ? livePresence : EMPTY_PRESENCE,
		followingId: live ? followingId : null,
	}
}

export function followPerson(personId: string): void {
	// stub: following scrolls the editor to the remote cursor once awareness is available
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
