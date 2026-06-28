import { beforeEach, describe, expect, it } from "vitest"
import { useSyncLogStore } from "../../stores/syncLogStore"

beforeEach(() => {
	useSyncLogStore.setState({ entries: [], nextId: 0 })
})

describe("log()", () => {
	it("appends an entry with the correct level and message", () => {
		useSyncLogStore.getState().log("info", "Test message")
		const { entries } = useSyncLogStore.getState()
		expect(entries).toHaveLength(1)
		expect(entries[0].level).toBe("info")
		expect(entries[0].message).toBe("Test message")
	})

	it("assigns auto-incrementing ids", () => {
		useSyncLogStore.getState().log("info", "First")
		useSyncLogStore.getState().log("info", "Second")
		const { entries } = useSyncLogStore.getState()
		expect(entries[0].id).toBe(0)
		expect(entries[1].id).toBe(1)
	})

	it("records a timestamp close to Date.now()", () => {
		const before = Date.now()
		useSyncLogStore.getState().log("info", "Test")
		const after = Date.now()
		const { entries } = useSyncLogStore.getState()
		expect(entries[0].timestamp).toBeGreaterThanOrEqual(before)
		expect(entries[0].timestamp).toBeLessThanOrEqual(after)
	})

	it("supports warn level", () => {
		useSyncLogStore.getState().log("warn", "Warning message")
		expect(useSyncLogStore.getState().entries[0].level).toBe("warn")
	})

	it("supports error level", () => {
		useSyncLogStore.getState().log("error", "Error message")
		expect(useSyncLogStore.getState().entries[0].level).toBe("error")
	})

	it("persists metadata when provided", () => {
		useSyncLogStore.getState().log("info", "With metadata", { vaultId: "abc123" })
		const { entries } = useSyncLogStore.getState()
		expect(entries[0].metadata).toEqual({ vaultId: "abc123" })
	})

	it("stores undefined metadata when not provided", () => {
		useSyncLogStore.getState().log("info", "No metadata")
		expect(useSyncLogStore.getState().entries[0].metadata).toBeUndefined()
	})

	it("evicts oldest entries when exceeding 500 (FIFO buffer)", () => {
		for (let i = 0; i < 501; i++) {
			useSyncLogStore.getState().log("info", `Message ${i}`)
		}
		const { entries } = useSyncLogStore.getState()
		expect(entries.length).toBe(500)
		expect(entries[0].message).toBe("Message 1")
		expect(entries[499].message).toBe("Message 500")
	})

	it("increments nextId monotonically across calls", () => {
		useSyncLogStore.getState().log("info", "A")
		useSyncLogStore.getState().log("info", "B")
		useSyncLogStore.getState().log("info", "C")
		expect(useSyncLogStore.getState().nextId).toBe(3)
	})
})

describe("clear()", () => {
	it("empties all entries", () => {
		useSyncLogStore.getState().log("info", "A")
		useSyncLogStore.getState().log("warn", "B")
		useSyncLogStore.getState().clear()
		expect(useSyncLogStore.getState().entries).toHaveLength(0)
	})

	it("preserves nextId counter after clear", () => {
		useSyncLogStore.getState().log("info", "A")
		useSyncLogStore.getState().clear()
		useSyncLogStore.getState().log("info", "B")
		// nextId continues from where it left off
		expect(useSyncLogStore.getState().entries[0].id).toBe(1)
	})
})
