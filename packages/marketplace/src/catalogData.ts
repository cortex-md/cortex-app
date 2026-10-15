import type {
	BlockedEntry,
	MarketplaceKind,
	MarketplaceStats,
	RegistryEntry,
	VerifiedEntry,
} from "./types"

const MAX_SCREENSHOTS = 6
const IMAGE_EXTENSION = /\.(?:png|jpe?g|gif|webp|avif|svg)(?:[?#].*)?$/iu

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

export function parseRegistryEntries(value: unknown): RegistryEntry[] {
	if (!Array.isArray(value)) throw new Error("Registry file is not a list")
	return value.filter(isRecord).map((entry) => {
		const { screenshots, ...rest } = entry as unknown as RegistryEntry
		const parsed = parseScreenshots(screenshots)
		return parsed.length > 0 ? { ...rest, screenshots: parsed } : rest
	})
}

export function parseScreenshots(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	const urls: string[] = []
	for (const item of value) {
		if (typeof item !== "string") continue
		const url = toHttpsUrl(item.trim())
		if (url && !urls.includes(url)) urls.push(url)
		if (urls.length === MAX_SCREENSHOTS) break
	}
	return urls
}

export function absolutizeReadmeUrls(markdown: string, repo: string, branch: string): string {
	const resolve = (target: string, forceImage: boolean) => {
		if (!target || /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/iu.test(target)) return target
		const path = target.replace(/^\.\//u, "").replace(/^\/+/u, "")
		return forceImage || IMAGE_EXTENSION.test(path)
			? `https://raw.githubusercontent.com/${repo}/${branch}/${path}`
			: `https://github.com/${repo}/blob/${branch}/${path}`
	}

	return markdown
		.replace(
			/(!?)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(\s+"[^"]*")?\s*\)/gu,
			(_match, bang: string, text: string, target: string, title = "") =>
				`${bang}[${text}](${resolve(target, bang === "!")}${title})`,
		)
		.replace(
			/^(\s{0,3}\[[^\]]+\]:\s*)<?(\S+?)>?(\s|$)/gmu,
			(_match, prefix: string, target: string, end: string) =>
				`${prefix}${resolve(target, false)}${end}`,
		)
		.replace(
			/(<img\b[^>]*?\ssrc=)(["'])([^"']+)\2/giu,
			(_match, prefix: string, quote: string, target: string) =>
				`${prefix}${quote}${resolve(target, true)}${quote}`,
		)
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

function toHttpsUrl(value: string): string | null {
	try {
		const url = new URL(value)
		return url.protocol === "https:" ? url.toString() : null
	} catch {
		return null
	}
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
