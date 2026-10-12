import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const listDeletedFiles = vi.fn()
const restoreDeletedFile = vi.fn()
const downloadVersion = vi.fn()

const syncState = { listDeletedFiles, restoreDeletedFile, downloadVersion }

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

import { DeletedNotesPanel } from "../../../features/sync/DeletedNotesPanel"

const deletedFiles = [
	{
		filePath: "Notes/Plan.md",
		version: 3,
		sizeBytes: 120,
		checksum: "checksum",
		contentType: "text/markdown",
		deletedAt: "2026-06-13T12:00:00Z",
		lastModifiedBy: "user-1",
		lastDeviceId: "device-1",
	},
]

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("DeletedNotesPanel", () => {
	it("loads deleted notes and previews the selected file in a scrollable region", async () => {
		listDeletedFiles.mockResolvedValue(deletedFiles)
		downloadVersion.mockResolvedValue("# Recovered plan")

		render(<DeletedNotesPanel open onOpenChange={vi.fn()} />)

		await userEvent.click(await screen.findByRole("button", { name: /^Plan/ }))

		expect(await screen.findByTestId("reading-view")).toHaveTextContent("# Recovered plan")
		expect(downloadVersion).toHaveBeenCalledWith("remote-vault-id", "/vault", "Notes/Plan.md", "0")
		expect(screen.getByText("Restores to")).toHaveTextContent("Restores to Notes")
	})

	it("restores the selected note and removes it from the recovery list", async () => {
		listDeletedFiles.mockResolvedValue(deletedFiles)
		downloadVersion.mockResolvedValue("# Recovered plan")
		restoreDeletedFile.mockResolvedValue(undefined)

		render(<DeletedNotesPanel open onOpenChange={vi.fn()} />)

		await userEvent.click(await screen.findByRole("button", { name: /^Plan/ }))
		await screen.findByTestId("reading-view")
		await userEvent.click(screen.getByRole("button", { name: "Restore note" }))

		await waitFor(() => {
			expect(restoreDeletedFile).toHaveBeenCalledWith("remote-vault-id", "/vault", "Notes/Plan.md")
		})
		expect(screen.queryByRole("button", { name: /^Plan/ })).not.toBeInTheDocument()
		expect(screen.getByText("No deleted notes")).toBeInTheDocument()
	})
})
