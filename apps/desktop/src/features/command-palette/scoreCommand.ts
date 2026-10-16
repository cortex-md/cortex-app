import type { CommandEntry } from "@cortex/commands"

const WORD_START_BONUS = 3
const CONSECUTIVE_BONUS = 2
const GAP_PENALTY = 0.1

function scoreText(haystack: string, needle: string): number | null {
	let score = 0
	let position = 0
	let previousMatch = -2
	for (const character of needle) {
		const index = haystack.indexOf(character, position)
		if (index === -1) return null
		if (index === 0 || haystack[index - 1] === " ") score += WORD_START_BONUS
		if (index === previousMatch + 1) score += CONSECUTIVE_BONUS
		score -= (index - position) * GAP_PENALTY
		previousMatch = index
		position = index + 1
	}
	return score + 1
}

export function scoreCommand(command: CommandEntry, query: string): number | null {
	const needle = query.trim().toLowerCase().replace(/\s+/g, " ")
	if (!needle) return 0
	const label = scoreText(command.label.toLowerCase(), needle)
	const aliases = (command.aliases ?? []).map((alias) =>
		scoreText(alias.toLowerCase().replace(/-/g, " "), needle),
	)
	const category = scoreText(`${command.category} ${command.label}`.toLowerCase(), needle)
	const candidates = [label, ...aliases, category === null ? null : category - 1]
	const best = candidates.reduce<number | null>(
		(current, candidate) =>
			candidate === null ? current : current === null ? candidate : Math.max(current, candidate),
		null,
	)
	return best
}
