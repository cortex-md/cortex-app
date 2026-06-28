import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const getVersionHistory = vi.fn()
const downloadVersion = vi.fn()
const restoreVersion = vi.fn()

vi.mock("@cortex/core", () => ({
	useRemoteVaultStore: () => ({ linkedVaultId: "remote-vault-id" }),
	useSyncStore: () => ({
		getVersionHistory,
		downloadVersion,
		restoreVersion,
	}),
	useVaultStore: () => ({
		vault: { path: "/vault", name: "Writing", uuid: "vault-id", fileCount: 1 },
	}),
}))

vi.mock("@cortex/theme", () => ({
	getThemeManager: () => ({
		getActiveTheme: () => ({ isDark: false }),
		subscribe: () => () => {},
	}),
}))

vi.mock("@pierre/diffs", () => ({
	parseDiffFromFile: () => ({
		hunks: [{ additionLines: 2, deletionLines: 1 }],
	}),
}))

vi.mock("@pierre/diffs/react", () => ({
	FileDiff: () => <div data-testid="file-diff">Rendered diff</div>,
}))

import { NoteHistoryPanel } from "../../../features/sync/NoteHistoryPanel"

const versions = [
	{
		snapshotId: "snapshot-2",
		version: 2,
		sizeBytes: 20,
		checksum: "two",
		authorId: "user-1",
		authorName: "Ada",
		deviceId: "device-1",
		deviceName: "MacBook",
		createdAt: "2026-06-13T12:00:00Z",
	},
	{
		snapshotId: "snapshot-1",
		version: 1,
		sizeBytes: 10,
		checksum: "one",
		authorId: "user-1",
		authorName: "Ada",
		deviceId: "device-1",
		deviceName: "MacBook",
		createdAt: "2026-06-12T12:00:00Z",
	},
]

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("NoteHistoryPanel", () => {
	it("loads versions and renders the diff inside an independently scrollable region", async () => {
		getVersionHistory.mockResolvedValue(versions)
		downloadVersion.mockResolvedValueOnce("new content").mockResolvedValueOnce("old content")

		render(<NoteHistoryPanel filePath="/vault/Notes/Plan.md" open onOpenChange={vi.fn()} />)

		expect(await screen.findByRole("button", { name: /Ada.*Latest/i })).toBeInTheDocument()

		await userEvent.click(screen.getByRole("button", { name: /Ada.*Latest/i }))

		expect(await screen.findByTestId("file-diff")).toBeInTheDocument()
		expect(downloadVersion).toHaveBeenNthCalledWith(
			1,
			"remote-vault-id",
			"/vault",
			"Notes/Plan.md",
			"2",
		)
		expect(document.querySelector('[data-slot="note-history-diff"]')).toHaveClass(
			"min-h-0",
			"overflow-auto",
		)
		expect(screen.getByText("+2")).toBeInTheDocument()
		expect(screen.getByText("-1")).toBeInTheDocument()
	})

	it("restores the selected version and closes the panel", async () => {
		getVersionHistory.mockResolvedValue(versions)
		downloadVersion.mockResolvedValueOnce("new content").mockResolvedValueOnce("old content")
		restoreVersion.mockResolvedValue(undefined)
		const onOpenChange = vi.fn()

		render(<NoteHistoryPanel filePath="/vault/Notes/Plan.md" open onOpenChange={onOpenChange} />)

		await userEvent.click(await screen.findByRole("button", { name: /Ada.*Latest/i }))
		await screen.findByTestId("file-diff")
		fireEvent.click(screen.getByRole("button", { name: "Restore version" }))

		await waitFor(() => {
			expect(restoreVersion).toHaveBeenCalledWith("remote-vault-id", "/vault", "Notes/Plan.md", "2")
		})
		expect(onOpenChange).toHaveBeenCalledWith(false)
	})
})
