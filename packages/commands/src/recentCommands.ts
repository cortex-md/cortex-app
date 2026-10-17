import type { CommandEntry } from "./types"

export const RECENT_COMMAND_LIMIT = 10

export function pushRecentCommandId(
	ids: readonly string[],
	commandId: string,
	limit = RECENT_COMMAND_LIMIT,
): string[] {
	return [commandId, ...ids.filter((id) => id !== commandId)].slice(0, limit)
}

export function normalizeRecentCommandIds(value: unknown, limit = RECENT_COMMAND_LIMIT): string[] {
	if (!Array.isArray(value)) return []
	const ids: string[] = []
	for (const id of value) {
		if (typeof id !== "string" || !id || ids.includes(id)) continue
		ids.push(id)
		if (ids.length >= limit) break
	}
	return ids
}

export function resolveRecentCommands(
	ids: readonly string[],
	commands: readonly CommandEntry[],
	limit: number,
): CommandEntry[] {
	if (ids.length === 0 || limit <= 0) return []
	const commandsById = new Map(commands.map((command) => [command.id, command]))
	const resolved: CommandEntry[] = []
	for (const id of ids) {
		const command = commandsById.get(id)
		if (!command) continue
		resolved.push(command)
		if (resolved.length >= limit) break
	}
	return resolved
}
