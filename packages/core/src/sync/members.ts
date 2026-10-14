import type { AccessRule, PathGrant, VaultMember } from "@cortex/platform"

export interface RoleInfo {
	label: string
	description: string
}

const ROLE_INFO: Record<string, RoleInfo> = {
	owner: { label: "Owner", description: "Full control of the vault" },
	admin: { label: "Admin", description: "Manages members and access" },
	editor: { label: "Editor", description: "Can edit all notes they can access" },
	viewer: { label: "Viewer", description: "Can read" },
	guest: { label: "Guest", description: "Only sees the notes and folders you pick" },
}

export const TEAM_ROLES = ["admin", "editor", "viewer"] as const

export function roleInfo(role: string): RoleInfo {
	return ROLE_INFO[role] ?? { label: role.charAt(0).toUpperCase() + role.slice(1), description: "" }
}

export function grantsByUser(rules: readonly AccessRule[]): Map<string, PathGrant[]> {
	const grants = new Map<string, PathGrant[]>()
	for (const rule of rules) {
		for (const entry of rule.entries) {
			if (entry.principalType !== "user") continue
			const list = grants.get(entry.principalId) ?? []
			list.push({ path: rule.path, canWrite: entry.level === "edit" })
			grants.set(entry.principalId, list)
		}
	}
	return grants
}

export function buildUserGrantRules(
	rules: readonly AccessRule[],
	userId: string,
	previous: readonly PathGrant[],
	next: readonly PathGrant[],
): AccessRule[] {
	const nextByPath = new Map(next.map((grant) => [grant.path, grant]))
	const changedPaths = new Set([
		...previous.filter((grant) => !nextByPath.has(grant.path)).map((grant) => grant.path),
		...next
			.filter((grant) => {
				const before = previous.find((candidate) => candidate.path === grant.path)
				return !before || before.canWrite !== grant.canWrite
			})
			.map((grant) => grant.path),
	])
	return [...changedPaths].map((path) => {
		const rule = rules.find((candidate) => candidate.path === path)
		const otherEntries = (rule?.entries ?? []).filter(
			(entry) => entry.principalType !== "user" || entry.principalId !== userId,
		)
		const grant = nextByPath.get(path)
		return {
			path,
			restricted: rule?.restricted ?? false,
			entries: grant
				? [
						...otherEntries,
						{
							principalType: "user" as const,
							principalId: userId,
							level: grant.canWrite ? ("edit" as const) : ("view" as const),
						},
					]
				: otherEntries,
		}
	})
}

export const ADMIN_ROLES: ReadonlySet<string> = new Set(["owner", "admin"])

export function isVaultAdminRole(role: string | null | undefined): boolean {
	return role !== null && role !== undefined && ADMIN_ROLES.has(role)
}

export function memberDisplayName(member: Pick<VaultMember, "displayName" | "email">): string {
	return member.displayName.trim() || member.email
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}
