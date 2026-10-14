import type { AvatarTint } from "@/components/ui/Avatar"

export type CollabRole = "Owner" | "Editor" | "Viewer" | "Guest"

export interface CollabPerson {
	id: string
	name: string
	email: string
	role: CollabRole
	tint: AvatarTint
	isYou: boolean
}

export interface CollabPresenceEntry {
	personId: string
	section: string
}

export interface CollabPendingInvite {
	id: string
	email: string
	role: CollabRole
	expiresLabel: string
}
