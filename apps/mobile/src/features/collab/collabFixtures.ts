import type { AvatarTint } from "@/components/ui/Avatar"

export type CollabRole = "Owner" | "Editor" | "Viewer"

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

export const FIXTURE_VAULT_NAME = "Work"
export const FIXTURE_LIVE_NOTE_TITLE = "Launch plan"
export const FIXTURE_SYNC_SERVER = "Cortex Cloud"

export const FIXTURE_PEOPLE: CollabPerson[] = [
	{
		id: "ana",
		name: "Ana Moreira",
		email: "ana@cortex.app",
		role: "Owner",
		tint: "accent",
		isYou: true,
	},
	{
		id: "bruno",
		name: "Bruno Kim",
		email: "bruno@cortex.app",
		role: "Editor",
		tint: "blue",
		isYou: false,
	},
	{
		id: "carla",
		name: "Carla Lima",
		email: "carla@cortex.app",
		role: "Editor",
		tint: "green",
		isYou: false,
	},
	{
		id: "diego",
		name: "Diego Pires",
		email: "diego@cortex.app",
		role: "Viewer",
		tint: "violet",
		isYou: false,
	},
]

export const FIXTURE_VAULT_MEMBERS: CollabPerson[] = [
	FIXTURE_PEOPLE[0],
	{
		id: "joao",
		name: "João Silva",
		email: "joao@cortex.app",
		role: "Editor",
		tint: "blue",
		isYou: false,
	},
	{
		id: "lia",
		name: "Lia Costa",
		email: "lia@cortex.app",
		role: "Editor",
		tint: "green",
		isYou: false,
	},
]

export const FIXTURE_LIVE_PRESENCE: CollabPresenceEntry[] = [
	{ personId: "ana", section: "" },
	{ personId: "bruno", section: "Announcement" },
	{ personId: "carla", section: "This week" },
]

export const FIXTURE_LAST_EDITOR = { personId: "ana", label: "Edited 2 min ago" }
