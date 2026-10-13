import type { AvatarTint } from "@/components/ui/Avatar"

export type MemberRole = "owner" | "editor" | "viewer"

export interface MemberRecord {
	id: string
	name: string
	email: string
	role: MemberRole
	joinedLabel: string
	isYou: boolean
	avatarTint: AvatarTint
}

export interface PendingInviteRecord {
	id: string
	email: string
	role: MemberRole
	expiresLabel: string
}

export const FIXTURE_MEMBERS: MemberRecord[] = [
	{
		id: "ana",
		name: "Ana Moreira",
		email: "ana@example.com",
		role: "owner",
		joinedLabel: "Joined Jan 2026",
		isYou: true,
		avatarTint: "accent",
	},
	{
		id: "bruno",
		name: "Bruno Kim",
		email: "bruno@example.com",
		role: "editor",
		joinedLabel: "Joined Mar 2026",
		isYou: false,
		avatarTint: "blue",
	},
	{
		id: "carla",
		name: "Carla Lima",
		email: "carla@example.com",
		role: "editor",
		joinedLabel: "Joined Apr 2026",
		isYou: false,
		avatarTint: "green",
	},
	{
		id: "diego",
		name: "Diego Pires",
		email: "diego@example.com",
		role: "viewer",
		joinedLabel: "Joined Sep 2026",
		isYou: false,
		avatarTint: "violet",
	},
]

export const FIXTURE_PENDING_INVITES: PendingInviteRecord[] = [
	{
		id: "invite-1",
		email: "invitee@example.com",
		role: "viewer",
		expiresLabel: "Expires in 7 days",
	},
]
