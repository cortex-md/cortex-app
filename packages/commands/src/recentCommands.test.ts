import { describe, expect, it } from "vitest"
import {
	normalizeRecentCommandIds,
	pushRecentCommandId,
	RECENT_COMMAND_LIMIT,
	resolveRecentCommands,
} from "./recentCommands"
import type { CommandEntry } from "./types"

function command(id: string): CommandEntry {
	return { id, label: id, category: "Test", execute: () => {} }
}

describe("recent commands", () => {
	it("moves a repeated command to the front and caps the list", () => {
		const ids = Array.from({ length: RECENT_COMMAND_LIMIT }, (_, index) => `command.${index}`)
		expect(pushRecentCommandId(ids, "command.4").slice(0, 2)).toEqual(["command.4", "command.0"])
		const pushed = pushRecentCommandId(ids, "command.new")
		expect(pushed).toHaveLength(RECENT_COMMAND_LIMIT)
		expect(pushed[0]).toBe("command.new")
		expect(pushed).not.toContain(`command.${RECENT_COMMAND_LIMIT - 1}`)
	})

	it("normalizes persisted values from the workspace file", () => {
		expect(normalizeRecentCommandIds(undefined)).toEqual([])
		expect(normalizeRecentCommandIds("file.new")).toEqual([])
		expect(normalizeRecentCommandIds(["file.new", 3, "", "file.new", "app.settings"])).toEqual([
			"file.new",
			"app.settings",
		])
	})

	it("skips commands that are no longer registered", () => {
		const commands = [command("file.new"), command("app.settings")]
		const resolved = resolveRecentCommands(["plugin:gone", "app.settings", "file.new"], commands, 3)
		expect(resolved.map((entry) => entry.id)).toEqual(["app.settings", "file.new"])
		expect(resolveRecentCommands(["file.new", "app.settings"], commands, 1)).toHaveLength(1)
	})
})
