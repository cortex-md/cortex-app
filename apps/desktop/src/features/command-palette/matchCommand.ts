import type { CommandEntry } from "@cortex/commands"
import type { SearchMatchRange } from "@cortex/search"

const WORD_START_BONUS = 3
const CONSECUTIVE_BONUS = 2
const GAP_PENALTY = 0.1

export interface CommandMatch {
	score: number
	labelRanges: SearchMatchRange[]
}

interface TextMatch {
	score: number
	indexes: number[]
}

function matchText(haystack: string, needle: string): TextMatch | null {
	let score = 0
	let position = 0
	let previousMatch = -2
	const indexes: number[] = []
	for (const character of needle) {
		const index = haystack.indexOf(character, position)
		if (index === -1) return null
		if (index === 0 || haystack[index - 1] === " ") score += WORD_START_BONUS
		if (index === previousMatch + 1) score += CONSECUTIVE_BONUS
		score -= (index - position) * GAP_PENALTY
		indexes.push(index)
		previousMatch = index
		position = index + 1
	}
	return { score: score + 1, indexes }
}

function toRanges(indexes: readonly number[]): SearchMatchRange[] {
	const ranges: [number, number][] = []
	for (const index of indexes) {
		const last = ranges.at(-1)
		if (last && last[1] === index) last[1] = index + 1
		else ranges.push([index, index + 1])
	}
	return ranges.filter(([start, end]) => end - start > 1 || indexes.length === 1)
}

export function normalizeCommandQuery(query: string): string {
	return query.trim().toLowerCase().replace(/\s+/g, " ")
}

export function matchCommand(command: CommandEntry, query: string): CommandMatch | null {
	const needle = normalizeCommandQuery(query)
	if (!needle) return { score: 0, labelRanges: [] }
	const label = matchText(command.label.toLowerCase(), needle)
	let best = label?.score ?? null
	for (const alias of command.aliases ?? []) {
		const aliasMatch = matchText(alias.toLowerCase().replace(/-/g, " "), needle)
		if (aliasMatch && (best === null || aliasMatch.score > best)) best = aliasMatch.score
	}
	const category = matchText(`${command.category} ${command.label}`.toLowerCase(), needle)
	if (category && (best === null || category.score - 1 > best)) best = category.score - 1
	if (best === null) return null
	return { score: best, labelRanges: label ? toRanges(label.indexes) : [] }
}
