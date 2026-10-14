import { useMembersStore } from "@cortex/core"
import type { VaultGroup, VaultMember } from "@cortex/platform"
import { useMemo } from "react"

export {
	ADMIN_ROLES,
	EMAIL_REGEX,
	isVaultAdminRole,
	memberDisplayName,
	messageOf,
} from "@cortex/core/members"

export function useMemberDirectory(): ReadonlyMap<string, VaultMember> {
	const members = useMembersStore((state) => state.members)
	return useMemo(() => new Map(members.map((member) => [member.userId, member])), [members])
}

export function useGroupDirectory(): ReadonlyMap<string, VaultGroup> {
	const groups = useMembersStore((state) => state.groups)
	return useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups])
}
