import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const getVersionHistory = vi.fn()
const downloadVersion = vi.fn()
const restoreVersion = vi.fn()

const syncState = { getVersionHistory, downloadVersion, restoreVersion }

vi.mock("@cortex/core", async (importOriginal) => ({
	...(await importOriginal<typeof import("@cortex/core")>()),
	useRemoteVaultStore: (selector: (state: { linkedVaultId: string }) => unknown) =>
		selector({ linkedVaultId: "remote-vault-id" }),
	useSyncStore: Object.assign(
		(selector: (state: Record<string, unknown>) => unknown) => selector(syncState),
		{ getState: () => syncState },
	),
	useVaultStore: (selector?: (state: unknown) => unknown) => {
		const state = { vault: { path: "/vault", name: "Writing", uuid: "vault-id", fileCount: 1 } }
		return selector ? selector(state) : state
	},
}))

vi.mock("@cortex/editor/reading-view", () => ({
	ReadingView: ({ content }: { content: string }) => (
		<div data-testid="reading-view">{content}</div>
	),
}))

const contentByVersion: Record<string, string> = { "2": "new content", "1": "old content" }

import { NoteHistoryHost } from "../../../features/sync/NoteHistoryPanel"
import { noteHistoryModal } from "../../../features/sync/noteHistoryModal"

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
	it("loads versions and shows word-level changes against the previous version", async () => {
		getVersionHistory.mockResolvedValue(versions)
		downloadVersion.mockImplementation(
			async (_vaultId: string, _vaultPath: string, _path: string, version: string) =>
				contentByVersion[version] ?? "",
		)

		noteHistoryModal.open({ filePath: "/vault/Notes/Plan.md" })
		render(<NoteHistoryHost />)

		await userEvent.click(await screen.findByRole("button", { name: /Version 2/ }))

		expect(await screen.findByText("new")).toHaveClass("history-diff-word")
		expect(screen.getByText("old")).toHaveClass("history-diff-word")
		expect(downloadVersion).toHaveBeenCalledWith("remote-vault-id", "/vault", "Notes/Plan.md", "2")
		expect(await screen.findByText("+1")).toBeInTheDocument()
		expect(screen.getAllByText("−1").length).toBeGreaterThan(0)
	})

	it("restores the selected version and closes the panel", async () => {
		getVersionHistory.mockResolvedValue(versions)
		downloadVersion.mockImplementation(
			async (_vaultId: string, _vaultPath: string, _path: string, version: string) =>
				contentByVersion[version] ?? "",
		)
		restoreVersion.mockResolvedValue(undefined)
		noteHistoryModal.open({ filePath: "/vault/Notes/Plan.md" })
		render(<NoteHistoryHost />)

		fireEvent.click(await screen.findByRole("button", { name: /Version 1/ }))
		fireEvent.click(screen.getByRole("button", { name: "Restore this version" }))

		await waitFor(() => {
			expect(restoreVersion).toHaveBeenCalledWith("remote-vault-id", "/vault", "Notes/Plan.md", "1")
		})
		expect(noteHistoryModal.getTarget()).toBeNull()
	})
})
