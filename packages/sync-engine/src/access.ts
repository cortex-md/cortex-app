import type { EffectiveAccess, EffectiveAccessLevel, EffectiveAccessRule } from "@cortex/platform"

export interface SyncAccess {
	canRead(path: string): boolean
	canWrite(path: string): boolean
}

export const FULL_ACCESS: SyncAccess = {
	canRead: () => true,
	canWrite: () => true,
}

export const READ_ONLY_ACCESS: SyncAccess = {
	canRead: () => true,
	canWrite: () => false,
}

const LEVEL_RANK: Record<EffectiveAccessLevel, number> = { none: 0, view: 1, edit: 2 }

function ruleMatches(rule: EffectiveAccessRule, path: string): boolean {
	return rule.path.endsWith("/") ? path.startsWith(rule.path) : path === rule.path
}

export function accessLevel(access: EffectiveAccess, path: string): EffectiveAccessLevel {
	if (access.all) return "edit"
	let deepest: EffectiveAccessRule | null = null
	for (const rule of access.rules) {
		if (ruleMatches(rule, path) && (!deepest || rule.path.length > deepest.path.length)) {
			deepest = rule
		}
	}
	return deepest?.level ?? access.base
}

export function accessFor(access: EffectiveAccess): SyncAccess {
	if (access.all) return FULL_ACCESS
	return {
		canRead: (path) => LEVEL_RANK[accessLevel(access, path)] >= LEVEL_RANK.view,
		canWrite: (path) => LEVEL_RANK[accessLevel(access, path)] >= LEVEL_RANK.edit,
	}
}
