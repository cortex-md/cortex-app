import { useMembersStore } from "@cortex/core"
import type { VaultGroup, VaultMember } from "@cortex/platform"
import { useMemo } from "react"

export const ADMIN_ROLES: ReadonlySet<string> = new Set(["owner", "admin"])

export function isVaultAdminRole(role: string | null | undefined): boolean {
	return role !== null && role !== undefined && ADMIN_ROLES.has(role)
}

export function memberDisplayName(member: Pick<VaultMember, "displayName" | "email">): string {
	return member.displayName.trim() || member.email
}

export function useMemberDirectory(): ReadonlyMap<string, VaultMember> {
	const members = useMembersStore((state) => state.members)
	return useMemo(() => new Map(members.map((member) => [member.userId, member])), [members])
}

export function useGroupDirectory(): ReadonlyMap<string, VaultGroup> {
	const groups = useMembersStore((state) => state.groups)
	return useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups])
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}
