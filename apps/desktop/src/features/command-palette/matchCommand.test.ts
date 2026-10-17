import type { CommandEntry } from "@cortex/commands"
import { describe, expect, it } from "vitest"
import { matchCommand } from "./matchCommand"

function command(label: string, category = "Sync", aliases?: string[]): CommandEntry {
	return { id: label, label, category, aliases, execute: () => {} }
}

describe("matchCommand", () => {
	it("returns label ranges for consecutive matches", () => {
		expect(matchCommand(command("Toggle Sync Exclusion"), "sync")?.labelRanges).toEqual([[7, 11]])
	})

	it("matches aliases and categories without label ranges", () => {
		expect(
			matchCommand(command("New Note", "File", ["create-note"]), "create")?.labelRanges,
		).toEqual([])
		expect(matchCommand(command("Now", "Sync"), "sync now")).not.toBeNull()
		expect(matchCommand(command("Now", "Sync"), "publish")).toBeNull()
	})
})
