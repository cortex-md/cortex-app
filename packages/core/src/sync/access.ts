import type {
	AccessRule,
	EffectiveAccess,
	EffectiveAccessLevel,
	EffectiveAccessRule,
} from "@cortex/platform"

export interface AccessEvaluator {
	readonly restricted: boolean
	levelOf: (relativePath: string, isDirectory?: boolean) => EffectiveAccessLevel
	canRead: (relativePath: string, isDirectory?: boolean) => boolean
	canWrite: (relativePath: string, isDirectory?: boolean) => boolean
	canWriteTree: (relativePath: string, isDirectory: boolean) => boolean
}

const LEVEL_RANK: Record<EffectiveAccessLevel, number> = { none: 0, view: 1, edit: 2 }

export function normalizeAccessPath(relativePath: string, isDirectory = false): string {
	const trimmed = relativePath
		.replaceAll("\\", "/")
		.replace(/^\.\/+/, "")
		.replace(/^\/+/, "")
		.replace(/\/{2,}/g, "/")
	if (!isDirectory) return trimmed.replace(/\/+$/, "")
	if (!trimmed) return ""
	return trimmed.endsWith("/") ? trimmed : `${trimmed}/`
}

export function accessRuleCovers(rulePath: string, path: string): boolean {
	return rulePath === path || (rulePath.endsWith("/") && path.startsWith(rulePath))
}

export function isAtLeastAccessLevel(
	level: EffectiveAccessLevel,
	required: EffectiveAccessLevel,
): boolean {
	return LEVEL_RANK[level] >= LEVEL_RANK[required]
}

const FULL_ACCESS_EVALUATOR: AccessEvaluator = {
	restricted: false,
	levelOf: () => "edit",
	canRead: () => true,
	canWrite: () => true,
	canWriteTree: () => true,
}

export function createAccessEvaluator(access: EffectiveAccess | null): AccessEvaluator {
	if (!access || access.all) return FULL_ACCESS_EVALUATOR
	const rules: EffectiveAccessRule[] = [...access.rules].sort(
		(left, right) => right.path.length - left.path.length,
	)
	const cache = new Map<string, EffectiveAccessLevel>()

	const levelOfNormalized = (path: string): EffectiveAccessLevel => {
		const cached = cache.get(path)
		if (cached) return cached
		const rule = rules.find((candidate) => accessRuleCovers(candidate.path, path))
		const level = rule?.level ?? access.base
		cache.set(path, level)
		return level
	}

	const levelOf = (relativePath: string, isDirectory = false) =>
		levelOfNormalized(normalizeAccessPath(relativePath, isDirectory))

	return {
		restricted: true,
		levelOf,
		canRead: (relativePath, isDirectory) =>
			isAtLeastAccessLevel(levelOf(relativePath, isDirectory), "view"),
		canWrite: (relativePath, isDirectory) =>
			isAtLeastAccessLevel(levelOf(relativePath, isDirectory), "edit"),
		canWriteTree: (relativePath, isDirectory) => {
			const path = normalizeAccessPath(relativePath, isDirectory)
			if (!isAtLeastAccessLevel(levelOfNormalized(path), "edit")) return false
			if (!isDirectory) return true
			return rules.every(
				(rule) => !rule.path.startsWith(path) || isAtLeastAccessLevel(rule.level, "edit"),
			)
		},
	}
}

export function findAccessRule(rules: readonly AccessRule[], path: string): AccessRule | null {
	return rules.find((rule) => rule.path === path) ?? null
}

export function findInheritedRestriction(
	rules: readonly AccessRule[],
	path: string,
): AccessRule | null {
	let inherited: AccessRule | null = null
	for (const rule of rules) {
		if (!rule.restricted || rule.path === path || !rule.path.endsWith("/")) continue
		if (!path.startsWith(rule.path)) continue
		if (!inherited || rule.path.length > inherited.path.length) inherited = rule
	}
	return inherited
}
