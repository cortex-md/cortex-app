import type {
	BlockedEntry,
	RegistryEntry,
	RegistryItemStats,
	RegistryKind,
	RegistryManifest,
	RegistryStats,
	ThemePalette,
	VerifiedEntry,
} from "./types"

export const defaultRegistryRepo = "cortex-md/registry"

const repoPattern = /^[\w.-]+\/[\w.-]+$/u
const colorPattern = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\([\d\s.,%/-]+\))$/iu

export function registryFileUrl(repo: string, branch: "main" | "data", fileName: string) {
	return `https://raw.githubusercontent.com/${repo}/${branch}/${fileName}`
}

export function isRepoSlug(value: string) {
	return repoPattern.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isKind(value: unknown): value is RegistryKind {
	return value === "plugin" || value === "theme"
}

function optionalString(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : null
}

function toHttpUrl(value: unknown) {
	const text = optionalString(value)
	if (!text) return null
	try {
		const url = new URL(text)
		return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null
	} catch {
		return null
	}
}

const MAX_SCREENSHOTS = 6

export function parseScreenshots(value: unknown) {
	if (!Array.isArray(value)) return []
	const urls: string[] = []
	for (const item of value) {
		const url = toHttpUrl(item)
		if (url?.startsWith("https://") && !urls.includes(url)) urls.push(url)
		if (urls.length === MAX_SCREENSHOTS) break
	}
	return urls
}

export function parseRegistryEntries(value: unknown): RegistryEntry[] | null {
	if (!Array.isArray(value)) return null
	return value.flatMap((item): RegistryEntry[] => {
		if (!isRecord(item)) return []
		const id = optionalString(item.id)
		const name = optionalString(item.name)
		const author = optionalString(item.author)
		const repo = optionalString(item.repo)
		if (!id || !name || !author || !repo || !isRepoSlug(repo)) return []
		const authorUrl = toHttpUrl(item.authorUrl)
		return [
			{
				id,
				name,
				author,
				...(authorUrl ? { authorUrl } : {}),
				description: optionalString(item.description) ?? "",
				coverImageUrl: toHttpUrl(item.coverImageUrl) ?? "",
				screenshots: parseScreenshots(item.screenshots),
				repo,
			},
		]
	})
}

function parseItemStats(value: unknown): RegistryItemStats | null {
	if (!isRecord(value)) return null
	const stats: RegistryItemStats = {}
	for (const key of ["downloads", "stars", "votes"] as const) {
		const number = value[key]
		if (typeof number === "number" && Number.isFinite(number) && number >= 0) stats[key] = number
	}
	const latest = optionalString(value.latest)
	if (latest) stats.latest = latest
	const releasedAt = optionalString(value.releasedAt)
	if (releasedAt && !Number.isNaN(Date.parse(releasedAt))) stats.releasedAt = releasedAt
	if (isRecord(value.discussion)) {
		const url = toHttpUrl(value.discussion.url)
		const number = value.discussion.number
		if (url && typeof number === "number") stats.discussion = { number, url }
	}
	return stats
}

function parseStatsGroup(value: unknown) {
	if (!isRecord(value)) return {}
	const group: Record<string, RegistryItemStats> = {}
	for (const [id, stats] of Object.entries(value)) {
		const parsed = parseItemStats(stats)
		if (parsed) group[id] = parsed
	}
	return group
}

export function parseRegistryStats(value: unknown): RegistryStats | null {
	if (!isRecord(value) || !isRecord(value.plugins) || !isRecord(value.themes)) return null
	return {
		generatedAt: optionalString(value.generatedAt),
		plugins: parseStatsGroup(value.plugins),
		themes: parseStatsGroup(value.themes),
	}
}

export function parseVerifiedEntries(value: unknown): VerifiedEntry[] | null {
	if (!Array.isArray(value)) return null
	return value.flatMap((item) =>
		isRecord(item) && isKind(item.kind) && typeof item.id === "string"
			? [{ kind: item.kind, id: item.id }]
			: [],
	)
}

export function parseBlockedEntries(value: unknown): BlockedEntry[] | null {
	if (!Array.isArray(value)) return null
	return value.flatMap((item): BlockedEntry[] => {
		if (!isRecord(item) || !isKind(item.kind) || typeof item.id !== "string") return []
		const versions =
			item.versions === null
				? null
				: Array.isArray(item.versions)
					? item.versions.filter((version): version is string => typeof version === "string")
					: null
		return [
			{
				kind: item.kind,
				id: item.id,
				reason: typeof item.reason === "string" ? item.reason : "",
				versions,
			},
		]
	})
}

export function findBlockedEntry(blocked: readonly BlockedEntry[], kind: RegistryKind, id: string) {
	return blocked.find((entry) => entry.kind === kind && entry.id === id) ?? null
}

export function isVerifiedEntry(
	verified: readonly VerifiedEntry[],
	kind: RegistryKind,
	id: string,
) {
	return verified.some((entry) => entry.kind === kind && entry.id === id)
}

export function getItemStats(
	stats: RegistryStats | null,
	group: "plugins" | "themes",
	id: string,
): RegistryItemStats | null {
	return stats?.[group][id] ?? null
}

function normalizeCapabilities(...values: unknown[]) {
	const seen = new Set<string>()
	for (const value of values) {
		if (!Array.isArray(value)) continue
		for (const item of value) {
			if (typeof item !== "string") continue
			const capability = item.trim()
			if (capability && capability.length <= 64) seen.add(capability)
		}
	}
	return [...seen]
}

function safeRelativePath(value: unknown) {
	const path = optionalString(value)
	if (!path) return null
	const normalized = path.replaceAll("\\", "/")
	if (normalized.startsWith("/") || /^[a-z]:/iu.test(normalized)) return null
	if (normalized.split("/").some((segment) => segment === "..")) return null
	return normalized
}

export function parseRegistryManifest(value: unknown): RegistryManifest | null {
	if (!isRecord(value)) return null
	const colorschemes = isRecord(value.colorschemes) ? value.colorschemes : {}
	return {
		displayName: optionalString(value.displayName),
		version: optionalString(value.version),
		minAppVersion: optionalString(value.minAppVersion),
		icon: optionalString(value.icon),
		capabilities: normalizeCapabilities(value.capabilities, value.permissions),
		colorschemes: {
			light: safeRelativePath(colorschemes.light),
			dark: safeRelativePath(colorschemes.dark),
		},
	}
}

function readCssVariables(css: string) {
	const variables = new Map<string, string>()
	const pattern = /--([\w-]+)\s*:\s*([^;]+);/gu
	for (const match of css.matchAll(pattern)) {
		const name = match[1]
		const raw = match[2]?.trim()
		if (name && raw && !variables.has(name)) variables.set(name, raw)
	}
	return variables
}

function resolveColor(variables: Map<string, string>, names: string[]) {
	for (const name of names) {
		let value = variables.get(name)
		for (let depth = 0; value && depth < 4; depth += 1) {
			const reference = /^var\(--([\w-]+)\)$/u.exec(value)
			if (!reference?.[1]) break
			value = variables.get(reference[1])
		}
		if (value && colorPattern.test(value)) return value
	}
	return null
}

export function parseThemePalette(css: string, label: ThemePalette["label"]): ThemePalette | null {
	const variables = readCssVariables(css)
	const bg = resolveColor(variables, ["bg-primary"])
	const text = resolveColor(variables, ["text-primary"])
	if (!bg || !text) return null
	const side = resolveColor(variables, ["sidebar-bg", "bg-secondary"]) ?? bg
	const accent = resolveColor(variables, ["accent-text", "accent"]) ?? text
	return {
		label,
		bg,
		side,
		text,
		muted: resolveColor(variables, ["text-muted", "text-secondary"]) ?? text,
		accent,
		fill: resolveColor(variables, ["accent"]) ?? accent,
		line: resolveColor(variables, ["border-subtle", "border"]) ?? side,
		tag: resolveColor(variables, ["tag-bg", "bg-tertiary"]) ?? side,
		tagText: resolveColor(variables, ["tag-text", "accent-text"]) ?? accent,
	}
}
