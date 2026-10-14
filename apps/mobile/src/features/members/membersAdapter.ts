import { getErrorMessage, useAuthStore, useMembersStore, useRemoteVaultStore } from "@cortex/core"
import type { VaultInvite, VaultMember } from "@cortex/platform"
import { useEffect } from "react"

import { toast } from "@/features/feedback/useToast"
import type { MemberRecord, MemberRole, PendingInviteRecord } from "@/features/members/memberTypes"

export interface GroupRecord {
	id: string
	name: string
	memberCount: number
}

interface MembersSnapshot {
	members: MemberRecord[]
	pending: PendingInviteRecord[]
	groups: GroupRecord[]
}

const AVATAR_TINTS: MemberRecord["avatarTint"][] = ["accent", "blue", "green", "violet"]

function toRole(role: string): MemberRole {
	if (role === "owner" || role === "admin") return "owner"
	return role === "viewer" || role === "guest" ? "viewer" : "editor"
}

function toServerRole(role: MemberRole): string {
	return role === "owner" ? "admin" : role
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

export function mapVaultMembers(
	members: VaultMember[],
	currentUserId: string | null,
): MemberRecord[] {
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

function linkedVaultId(): string | null {
	return useRemoteVaultStore.getState().linkedVaultId
}

async function run(task: (vaultId: string) => Promise<unknown>): Promise<void> {
	const vaultId = linkedVaultId()
	if (!vaultId) {
		toast("Link this vault to manage members")
		return
	}
	try {
		await task(vaultId)
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

export function useVaultMembers(): MembersSnapshot {
	const vaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const members = useMembersStore((state) => state.members)
	const invites = useMembersStore((state) => state.invites)
	const groups = useMembersStore((state) => state.groups)
	const userId = useAuthStore((state) => state.user?.userId ?? null)

	useEffect(() => {
		if (!vaultId) return
		void useMembersStore
			.getState()
			.fetchOverview(vaultId)
			.catch(() => undefined)
		void useMembersStore
			.getState()
			.fetchInvites(vaultId)
			.catch(() => undefined)
	}, [vaultId])

	return {
		members: mapVaultMembers(members, userId),
		pending: mapVaultInvites(invites),
		groups: groups.map((group) => ({
			id: group.id,
			name: group.name,
			memberCount: group.memberIds.length,
		})),
	}
}

export function roleLabel(role: MemberRole): string {
	return role === "owner" ? "Owner" : role === "editor" ? "Editor" : "Viewer"
}

export function inviteMember(email: string, role: MemberRole): void {
	void run(async (vaultId) => {
		await useMembersStore.getState().createInvite(vaultId, email, toServerRole(role), "")
		toast(`Invited ${email}`)
	})
}

export function cancelInvite(inviteId: string): void {
	void run((vaultId) => useMembersStore.getState().deleteInvite(vaultId, inviteId))
}

export function changeMemberRole(memberId: string, role: MemberRole): void {
	void run((vaultId) =>
		useMembersStore.getState().updateMemberRole(vaultId, memberId, toServerRole(role)),
	)
}

export function removeMember(memberId: string): void {
	void run((vaultId) => useMembersStore.getState().removeMember(vaultId, memberId))
}

export function createGroup(name: string): void {
	void run(async (vaultId) => {
		await useMembersStore.getState().createGroup(vaultId, name, [])
		toast(`Created ${name}`)
	})
}

export function deleteGroup(groupId: string): void {
	void run((vaultId) => useMembersStore.getState().deleteGroup(vaultId, groupId))
}
