import type { BlockedEntry, MarketplaceKind, MarketplaceStats, VerifiedEntry } from "./types"

export function createEmptyStats(): MarketplaceStats {
	return { generatedAt: null, plugins: {}, themes: {} }
}

export function parseMarketplaceStats(value: unknown): MarketplaceStats | null {
	return isStats(value) ? value : null
}

export function parseVerifiedEntries(value: unknown): VerifiedEntry[] | null {
	return Array.isArray(value) ? value.filter(isVerifiedEntry) : null
}

export function parseBlockedEntries(value: unknown): BlockedEntry[] | null {
	return Array.isArray(value) ? value.filter(isBlockedEntry) : null
}

export function findBlockedEntry(
	blocked: readonly BlockedEntry[],
	kind: MarketplaceKind,
	id: string,
): BlockedEntry | null {
	return blocked.find((entry) => entry.kind === kind && entry.id === id) ?? null
}

export function isVersionBlocked(entry: BlockedEntry | null, version: string | null): boolean {
	if (!entry) return false
	if (entry.versions === null) return true
	return version !== null && entry.versions.includes(version.replace(/^v/, ""))
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isKind(value: unknown): value is MarketplaceKind {
	return value === "plugin" || value === "theme"
}

function isStats(value: unknown): value is MarketplaceStats {
	return isRecord(value) && isRecord(value.plugins) && isRecord(value.themes)
}

function isVerifiedEntry(value: unknown): value is VerifiedEntry {
	return isRecord(value) && isKind(value.kind) && typeof value.id === "string"
}

function isBlockedEntry(value: unknown): value is BlockedEntry {
	return (
		isRecord(value) &&
		isKind(value.kind) &&
		typeof value.id === "string" &&
		typeof value.reason === "string" &&
		(value.versions === null ||
			(Array.isArray(value.versions) &&
				value.versions.every((version) => typeof version === "string")))
	)
}
