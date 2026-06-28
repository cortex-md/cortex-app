import { describe, expect, it, vi } from "vitest"
import { CommandRegistry } from "./CommandRegistry"
import { buildVimCommandChoices, normalizeVimCommandName } from "./vimNames"

describe("CommandRegistry", () => {
	it("registers, executes, unregisters, and notifies subscribers", () => {
		const registry = new CommandRegistry()
		const execute = vi.fn()
		const subscriber = vi.fn()
		registry.subscribe(subscriber)

		const unregister = registry.register({
			id: "file.new",
			label: "New Note",
			category: "File",
			execute,
		})

		expect(subscriber).toHaveBeenCalledTimes(1)
		expect(registry.getAll()).toHaveLength(1)
		expect(
			registry.execute("file.new", { source: "test", payload: { parentPath: "/vault" } }),
		).toBe(true)
		expect(execute).toHaveBeenCalledWith({
			source: "test",
			payload: { parentPath: "/vault" },
		})

		unregister()

		expect(subscriber).toHaveBeenCalledTimes(2)
		expect(registry.execute("file.new", { source: "test" })).toBe(false)
	})

	it("returns stable snapshots until the registry changes", () => {
		const registry = new CommandRegistry()
		const firstSnapshot = registry.getSnapshot()

		registry.register({
			id: "file.new",
			label: "New Note",
			category: "File",
			execute: () => {},
		})

		const secondSnapshot = registry.getSnapshot()
		const repeatedSnapshot = registry.getSnapshot()

		expect(secondSnapshot.version).toBeGreaterThan(firstSnapshot.version)
		expect(secondSnapshot).toBe(repeatedSnapshot)
		expect(secondSnapshot.commands).toHaveLength(1)
	})

	it("does not let an old disposer remove a replacement command", () => {
		const registry = new CommandRegistry()
		const first = vi.fn()
		const second = vi.fn()

		const unregisterFirst = registry.register({
			id: "app.settings",
			label: "Settings",
			category: "App",
			execute: first,
		})
		registry.register({
			id: "app.settings",
			label: "Open Settings",
			category: "App",
			execute: second,
		})

		unregisterFirst()
		registry.execute("app.settings", { source: "test" })

		expect(first).not.toHaveBeenCalled()
		expect(second).toHaveBeenCalled()
	})

	it("reports command execution failures without throwing", async () => {
		const registry = new CommandRegistry()
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		try {
			registry.register({
				id: "sync.failure",
				label: "Sync Failure",
				category: "Test",
				execute: () => {
					throw new Error("sync failure")
				},
			})
			registry.register({
				id: "async.failure",
				label: "Async Failure",
				category: "Test",
				execute: async () => {
					throw new Error("async failure")
				},
			})

			expect(registry.execute("sync.failure", { source: "test" })).toBe(true)
			expect(registry.execute("async.failure", { source: "test" })).toBe(true)
			await Promise.resolve()

			expect(errorSpy).toHaveBeenCalledTimes(2)
			expect(errorSpy).toHaveBeenCalledWith('Command "sync.failure" failed', expect.any(Error))
			expect(errorSpy).toHaveBeenCalledWith('Command "async.failure" failed', expect.any(Error))
		} finally {
			errorSpy.mockRestore()
		}
	})

	it("resolves active vim choices and ignores removed commands", () => {
		const registry = new CommandRegistry()
		const execute = vi.fn()
		const unregister = registry.register({
			id: "file.new",
			label: "New Note",
			category: "File",
			aliases: ["new-note"],
			execute,
		})

		expect(registry.executeVimCommand("new_note")).toBe(true)
		expect(execute).toHaveBeenCalledWith({
			source: "vim",
			vimName: "new_note",
			input: undefined,
		})

		unregister()

		expect(registry.getVimChoices()).toEqual([])
		expect(registry.executeVimCommand("new_note")).toBe(false)
	})
})

describe("vim command names", () => {
	it("normalizes names for Vim command parsing", () => {
		expect(normalizeVimCommandName("file.new")).toBe("file_new")
		expect(normalizeVimCommandName("New Note")).toBe("new_note")
		expect(normalizeVimCommandName("123 jump")).toBe("cortex_123_jump")
		expect(normalizeVimCommandName("write")).toBe("cortex_write")
	})

	it("keeps primary ID names when aliases collide", () => {
		const choices = buildVimCommandChoices([
			{
				id: "file.new",
				label: "New Note",
				category: "File",
				aliases: ["open"],
				execute: () => {},
			},
			{
				id: "workspace.open",
				label: "Open Workspace",
				category: "Workspace",
				aliases: ["open"],
				execute: () => {},
			},
		])

		expect(choices.map((choice) => choice.name)).toContain("file_new")
		expect(choices.map((choice) => choice.name)).toContain("workspace_open")
		expect(choices.map((choice) => choice.name)).not.toContain("open")
	})
})
