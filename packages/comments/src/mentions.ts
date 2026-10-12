import type { MentionCandidate } from "./types"

export const MENTION_PATTERN = /@\[\[([^\]\n]+)\]\]/g

export interface MentionSegment {
	kind: "text" | "mention"
	text: string
	start: number
}

export function formatMention(name: string): string {
	return `@[[${name.trim()}]]`
}

export function extractMentions(text: string): string[] {
	const names = new Set<string>()
	for (const match of text.matchAll(MENTION_PATTERN)) {
		const name = match[1]?.trim()
		if (name) names.add(name)
	}
	return [...names]
}

export function splitMentions(text: string): MentionSegment[] {
	const segments: MentionSegment[] = []
	let cursor = 0
	for (const match of text.matchAll(MENTION_PATTERN)) {
		const start = match.index ?? 0
		if (start > cursor) {
			segments.push({ kind: "text", text: text.slice(cursor, start), start: cursor })
		}
		segments.push({ kind: "mention", text: match[1]?.trim() ?? "", start })
		cursor = start + match[0].length
	}
	if (cursor < text.length) segments.push({ kind: "text", text: text.slice(cursor), start: cursor })
	return segments
}

function normalizeName(name: string): string {
	return name.trim().toLocaleLowerCase()
}

export function resolveMentionTargets(
	names: readonly string[],
	candidates: readonly MentionCandidate[],
): string[] {
	const byName = new Map(candidates.map((candidate) => [normalizeName(candidate.name), candidate]))
	const userIds = new Set<string>()
	for (const name of names) {
		const candidate = byName.get(normalizeName(name))
		if (candidate) userIds.add(candidate.userId)
	}
	return [...userIds]
}

export function isMentionedBy(text: string, name: string): boolean {
	const target = normalizeName(name)
	return extractMentions(text).some((mention) => normalizeName(mention) === target)
}

export function filterMentionCandidates<T extends MentionCandidate>(
	candidates: readonly T[],
	query: string,
	limit = 8,
): T[] {
	const normalizedQuery = normalizeName(query)
	if (!normalizedQuery) return candidates.slice(0, limit)
	const startsWith: T[] = []
	const contains: T[] = []
	for (const candidate of candidates) {
		const name = normalizeName(candidate.name)
		if (name.startsWith(normalizedQuery)) startsWith.push(candidate)
		else if (name.includes(normalizedQuery)) contains.push(candidate)
	}
	return [...startsWith, ...contains].slice(0, limit)
}

export interface DisplayMention {
	start: number
	end: number
	name: string
}

const NAME_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g
const MENTION_BOUNDARY = "(?=$|[\\s.,;:!?)\\]}])"

function createDisplayMentionPattern(names: readonly string[]): RegExp | null {
	const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
	if (unique.length === 0) return null
	const alternatives = unique
		.sort((left, right) => right.length - left.length)
		.map((name) => name.replace(NAME_SPECIAL_CHARACTERS, "\\$&"))
		.join("|")
	return new RegExp(`(^|\\s)@(${alternatives})${MENTION_BOUNDARY}`, "giu")
}

function canonicalName(names: readonly string[], match: string): string {
	const normalized = normalizeName(match)
	return names.find((name) => normalizeName(name) === normalized) ?? match
}

export function toDisplayMentionText(text: string): string {
	return text.replace(MENTION_PATTERN, (_match, name: string) => `@${name.trim()}`)
}

export function findDisplayMentions(text: string, names: readonly string[]): DisplayMention[] {
	const pattern = createDisplayMentionPattern(names)
	if (!pattern) return []
	const mentions: DisplayMention[] = []
	for (const match of text.matchAll(pattern)) {
		const start = (match.index ?? 0) + (match[1]?.length ?? 0)
		const name = match[2] ?? ""
		mentions.push({ start, end: start + name.length + 1, name: canonicalName(names, name) })
	}
	return mentions
}

export function toStoredMentionText(text: string, names: readonly string[]): string {
	const mentions = findDisplayMentions(text, names)
	let result = ""
	let cursor = 0
	for (const mention of mentions) {
		result += `${text.slice(cursor, mention.start)}${formatMention(mention.name)}`
		cursor = mention.end
	}
	return result + text.slice(cursor)
}
