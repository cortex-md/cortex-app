import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const listDeletedFiles = vi.fn()
const restoreDeletedFile = vi.fn()
const downloadVersion = vi.fn()

vi.mock("@cortex/core", () => ({
	useRemoteVaultStore: () => ({ linkedVaultId: "remote-vault-id" }),
	useSyncStore: () => ({
		listDeletedFiles,
		restoreDeletedFile,
		downloadVersion,
	}),
	useVaultStore: () => ({
		vault: { path: "/vault", name: "Writing", uuid: "vault-id", fileCount: 1 },
	}),
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

		await userEvent.click(await screen.findByRole("button", { name: /^Plan\.md/ }))

		expect(await screen.findByText("# Recovered plan")).toBeInTheDocument()
		expect(downloadVersion).toHaveBeenCalledWith("remote-vault-id", "/vault", "Notes/Plan.md", "0")
		expect(document.querySelector('[data-slot="deleted-note-preview"]')).toHaveClass(
			"min-h-0",
			"overflow-auto",
		)
	})

	it("restores the selected note and removes it from the recovery list", async () => {
		listDeletedFiles.mockResolvedValue(deletedFiles)
		downloadVersion.mockResolvedValue("# Recovered plan")
		restoreDeletedFile.mockResolvedValue(undefined)

		render(<DeletedNotesPanel open onOpenChange={vi.fn()} />)

		await userEvent.click(await screen.findByRole("button", { name: /^Plan\.md/ }))
		await screen.findByText("# Recovered plan")
		await userEvent.click(screen.getByRole("button", { name: "Restore note" }))

		await waitFor(() => {
			expect(restoreDeletedFile).toHaveBeenCalledWith("remote-vault-id", "/vault", "Notes/Plan.md")
		})
		expect(screen.queryByRole("button", { name: /^Plan\.md/ })).not.toBeInTheDocument()
		expect(screen.getByText("No preview selected")).toBeInTheDocument()
	})
})
