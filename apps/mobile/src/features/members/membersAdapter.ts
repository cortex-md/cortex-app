import { useMembersStore } from "@cortex/core"
import type { VaultInvite, VaultMember } from "@cortex/platform"
import { useSyncExternalStore } from "react"

import {
	FIXTURE_MEMBERS,
	FIXTURE_PENDING_INVITES,
	type MemberRecord,
	type MemberRole,
	type PendingInviteRecord,
} from "@/features/members/membersFixtures"

interface MembersSnapshot {
	members: MemberRecord[]
	pending: PendingInviteRecord[]
}

const listeners = new Set<() => void>()
let snapshot: MembersSnapshot = { members: FIXTURE_MEMBERS, pending: FIXTURE_PENDING_INVITES }
let nextInviteId = FIXTURE_PENDING_INVITES.length + 1

function notify(): void {
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getSnapshot(): MembersSnapshot {
	return snapshot
}

function update(next: Partial<MembersSnapshot>): void {
	snapshot = { ...snapshot, ...next }
	notify()
}

const AVATAR_TINTS: MemberRecord["avatarTint"][] = ["accent", "blue", "green", "violet"]

function toRole(role: string): MemberRole {
	if (role === "owner" || role === "admin") return "owner"
	return role === "viewer" || role === "guest" ? "viewer" : "editor"
}

function formatJoined(joinedAt: string): string {
	const date = new Date(joinedAt)
	if (Number.isNaN(date.getTime())) return "Joined recently"
	return `Joined ${date.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
}

function formatExpires(expiresAt: string): string {
	const remaining = new Date(expiresAt).getTime() - Date.now()
	if (Number.isNaN(remaining) || remaining <= 0) return "Expired"
	const days = Math.max(1, Math.ceil(remaining / 86_400_000))
	return `Expires in ${days} ${days === 1 ? "day" : "days"}`
}

export function mapVaultMembers(members: VaultMember[], currentUserId: string | null): MemberRecord[] {
	return members.map((member, index) => ({
		id: member.userId,
		name: member.displayName || member.email,
		email: member.email,
		role: toRole(member.role),
		joinedLabel: formatJoined(member.joinedAt),
		isYou: member.userId === currentUserId,
		avatarTint: AVATAR_TINTS[index % AVATAR_TINTS.length] ?? "accent",
	}))
}

export function mapVaultInvites(invites: VaultInvite[]): PendingInviteRecord[] {
	return invites
		.filter((invite) => !invite.accepted)
		.map((invite) => ({
			id: invite.id,
			email: invite.inviteeEmail,
			role: toRole(invite.role),
			expiresLabel: formatExpires(invite.expiresAt),
		}))
}

export function useVaultMembers(): MembersSnapshot {
	const realMembers = useMembersStore((state) => state.members)
	const realInvites = useMembersStore((state) => state.invites)
	const local = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
	if (realMembers.length === 0) return local
	return { members: mapVaultMembers(realMembers, null), pending: mapVaultInvites(realInvites) }
}

export function roleLabel(role: MemberRole): string {
	return role === "owner" ? "Owner" : role === "editor" ? "Editor" : "Viewer"
}

export function inviteMember(email: string, role: MemberRole): void {
	// stub: remote invites need the sync server; the invite is kept in memory on mobile
	const invite: PendingInviteRecord = {
		id: `invite-${nextInviteId++}`,
		email,
		role,
		expiresLabel: "Expires in 7 days",
	}
	update({ pending: [...snapshot.pending, invite] })
}

export function cancelInvite(inviteId: string): void {
	// stub: remote invites need the sync server; the invite is removed from memory on mobile
	update({ pending: snapshot.pending.filter((invite) => invite.id !== inviteId) })
}

export function changeMemberRole(memberId: string, role: MemberRole): void {
	// stub: role changes need the sync server; the role is changed in memory on mobile
	update({
		members: snapshot.members.map((member) =>
			member.id === memberId ? { ...member, role } : member,
		),
	})
}

export function removeMember(memberId: string): void {
	// stub: member removal needs the sync server; the member is removed from memory on mobile
	update({ members: snapshot.members.filter((member) => member.id !== memberId) })
}
