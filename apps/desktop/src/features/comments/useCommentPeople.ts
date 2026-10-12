import { LOCAL_AUTHOR_ID } from "@cortex/comments"
import { useAuthStore, useMembersStore, useRemoteVaultStore } from "@cortex/core"
import type { VaultMember } from "@cortex/platform"
import { useEffect, useMemo } from "react"

export interface CommentPerson {
	userId: string
	name: string
	avatarUrl: string | null
	role: string | null
}

const LOCAL_PERSON: CommentPerson = {
	userId: LOCAL_AUTHOR_ID,
	name: "You",
	avatarUrl: null,
	role: null,
}

const ROLE_LABELS: Record<string, string> = {
	owner: "Owner",
	admin: "Admin",
	editor: "Editor",
	viewer: "Viewer",
	guest: "Guest",
}

export function toCommentPerson(member: VaultMember): CommentPerson {
	return {
		userId: member.userId,
		name: member.displayName || member.email,
		avatarUrl: member.avatarUrl,
		role: ROLE_LABELS[member.role] ?? null,
	}
}

export function useCommentPeople(): CommentPerson[] {
	const members = useMembersStore((state) => state.members)
	const remoteVaultId = useRemoteVaultStore((state) => state.syncConfig.remoteVaultId)
	const serverUrl = useRemoteVaultStore((state) => state.syncConfig.serverUrl)
	const authenticated = useAuthStore((state) => state.authenticated)

	useEffect(() => {
		if (!remoteVaultId || !authenticated) return
		void useMembersStore
			.getState()
			.ensureMembers(remoteVaultId, serverUrl ?? undefined)
			.catch(() => undefined)
	}, [authenticated, remoteVaultId, serverUrl])

	return useMemo(() => members.map(toCommentPerson), [members])
}

export function findCommentPerson(people: readonly CommentPerson[], userId: string): CommentPerson {
	if (userId === LOCAL_AUTHOR_ID) return LOCAL_PERSON
	return (
		people.find((person) => person.userId === userId) ?? {
			userId,
			name: "Unknown member",
			avatarUrl: null,
			role: null,
		}
	)
}
