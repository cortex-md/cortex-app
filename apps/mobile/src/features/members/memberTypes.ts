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
