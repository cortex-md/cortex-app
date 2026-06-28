import { type SyncLogEntry, useSyncLogStore } from "@cortex/core"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SyncLogsModal } from "../../../features/sync/SyncLogsModal"

const entries: SyncLogEntry[] = [
	{
		id: 0,
		timestamp: new Date("2026-06-13T12:00:00Z").getTime(),
		level: "info",
		message: "Sync connected",
		metadata: { vault: "Writing" },
	},
	{
		id: 1,
		timestamp: new Date("2026-06-13T12:01:00Z").getTime(),
		level: "error",
		message: "Upload failed",
		metadata: { path: "Notes/Plan.md" },
	},
]

beforeEach(() => {
	useSyncLogStore.setState({ entries, nextId: entries.length })
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText: vi.fn().mockResolvedValue(undefined) },
	})
})

afterEach(() => {
	cleanup()
	useSyncLogStore.setState({ entries: [], nextId: 0 })
	vi.restoreAllMocks()
})

describe("SyncLogsModal", () => {
	it("presents structured log entries and filters by level", async () => {
		render(<SyncLogsModal open onOpenChange={vi.fn()} />)

		expect(screen.getByRole("heading", { name: "Sync logs" })).toBeInTheDocument()
		expect(screen.getByText("Sync connected")).toBeInTheDocument()
		expect(screen.getByText("vault=Writing")).toBeInTheDocument()
		expect(screen.getByText("Upload failed")).toBeInTheDocument()

		await userEvent.click(screen.getByRole("radio", { name: "Show error logs" }))

		expect(screen.queryByText("Sync connected")).not.toBeInTheDocument()
		expect(screen.getByText("Upload failed")).toBeInTheDocument()
	})

	it("copies all entries and clears the session", async () => {
		render(<SyncLogsModal open onOpenChange={vi.fn()} />)

		await userEvent.click(screen.getByRole("button", { name: "Copy" }))

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			expect.stringContaining("[ERROR] Upload failed path=Notes/Plan.md"),
		)

		await userEvent.click(screen.getByRole("button", { name: "Clear" }))

		await waitFor(() => {
			expect(screen.getByText("No sync activity yet")).toBeInTheDocument()
		})
		expect(screen.getByRole("button", { name: "Copy" })).toBeDisabled()
	})
})
