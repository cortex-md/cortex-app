import {
	createDefaultSyncConfig,
	createDefaultSyncPreferences,
	useAuthStore,
	useMembersStore,
	useRemoteVaultStore,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NoteHeader } from "../../../features/split-view/NoteHeader"

const renameFile = vi.fn().mockResolvedValue("/vault/folder/Renamed.md")

beforeEach(() => {
	renameFile.mockClear()
	useAuthStore.setState({
		authenticated: false,
		user: null,
	})
	useRemoteVaultStore.setState({
		linkedVaultId: null,
		syncConfig: createDefaultSyncConfig(),
	})
	useSyncStore.setState({
		syncPreferences: createDefaultSyncPreferences(),
		noteMetadataRevisions: {},
	})
	useMembersStore.setState({
		members: [],
		memberCache: {},
		activeMemberCacheKey: null,
		ensureMembers: vi.fn().mockResolvedValue([]),
	})
	vi.mocked(getPlatform).mockReturnValue({
		capabilities: [],
		sync: {
			getNoteMetadata: vi.fn().mockResolvedValue(null),
		},
	} as never)
	useVaultStore.setState({
		vault: {
			uuid: "vault-id",
			path: "/vault",
			name: "My Vault",
			fileCount: 1,
		},
		renameFile,
	})
})

describe("NoteHeader", () => {
	it("shows the note-relative path without the vault name or markdown extension", () => {
		render(<NoteHeader filePath="/vault/folder/Current.md" />)

		expect(screen.queryByText("My Vault")).not.toBeInTheDocument()
		expect(screen.getByText("folder")).toBeInTheDocument()
		expect(screen.getByText("Current")).toBeInTheDocument()
		expect(screen.queryByText("Current.md")).not.toBeInTheDocument()
		expect(screen.getByRole("textbox", { name: "Note title" })).toHaveValue("Current")
		expect(screen.getByRole("button", { name: "Note actions" })).toBeInTheDocument()
		expect(screen.queryByText(/^Edited /)).not.toBeInTheDocument()
	})

	it("shows the latest synchronized editor with initials", async () => {
		const user = userEvent.setup()
		const editedAt = new Date(Date.now() - 60_000).toISOString()
		const ensureMembers = vi.fn().mockResolvedValue([
			{
				vaultId: "remote-vault-id",
				userId: "user-2",
				email: "ada@example.com",
				displayName: "Ada Lovelace",
				role: "editor",
				joinedAt: "2026-06-01T00:00:00.000Z",
			},
		])
		useRemoteVaultStore.setState({
			linkedVaultId: "remote-vault-id",
			syncConfig: {
				...createDefaultSyncConfig(),
				enabled: true,
				remoteVaultId: "remote-vault-id",
			},
		})
		useMembersStore.setState({ ensureMembers })
		vi.mocked(getPlatform).mockReturnValue({
			capabilities: [],
			sync: {
				getNoteMetadata: vi.fn().mockResolvedValue({
					createdAt: editedAt,
					createdBy: "user-1",
					lastEditedAt: editedAt,
					lastEditedBy: "user-2",
					lastDeviceId: "device-1",
					synced: true,
				}),
			},
		} as never)

		render(<NoteHeader filePath="/vault/folder/Current.md" />)

		expect(await screen.findByText(/Edited 1 minute ago by/)).toHaveTextContent(
			"Edited 1 minute ago by Ada Lovelace",
		)
		expect(screen.getByText("AL")).toBeInTheDocument()
		expect(ensureMembers).toHaveBeenCalledWith("remote-vault-id", "http://localhost:8080")

		await user.click(screen.getByRole("button", { name: "Note actions" }))
		expect(screen.getByRole("menuitem", { name: "Version History" })).toBeInTheDocument()
	})

	it("opens note actions for local notes without sync history", async () => {
		const user = userEvent.setup()
		render(<NoteHeader filePath="/vault/folder/Current.md" />)

		await user.click(screen.getByRole("button", { name: "Note actions" }))

		expect(screen.getByRole("menuitem", { name: "Open in New Tab" })).toBeInTheDocument()
		expect(screen.getByRole("menuitem", { name: "Make a Copy" })).toBeInTheDocument()
		expect(screen.queryByRole("menuitem", { name: "Version History" })).not.toBeInTheDocument()
	})

	it("renames the note on Enter while preserving the markdown extension", async () => {
		const user = userEvent.setup()
		render(<NoteHeader filePath="/vault/folder/Current.md" />)
		const title = screen.getByRole("textbox", { name: "Note title" })

		await user.clear(title)
		await user.type(title, "Renamed{Enter}")

		await waitFor(() => {
			expect(renameFile).toHaveBeenCalledWith("/vault/folder/Current.md", "Renamed.md")
		})
	})

	it("restores the current title on Escape", () => {
		render(<NoteHeader filePath="/vault/folder/Current.md" />)
		const title = screen.getByRole("textbox", { name: "Note title" })

		fireEvent.change(title, { target: { value: "Draft" } })
		fireEvent.keyDown(title, { key: "Escape" })

		expect(title).toHaveValue("Current")
		expect(renameFile).not.toHaveBeenCalled()
	})

	it("marks invalid titles using the input invalid state", () => {
		render(<NoteHeader filePath="/vault/folder/Current.md" />)
		const title = screen.getByRole("textbox", { name: "Note title" })

		fireEvent.change(title, { target: { value: "invalid/name" } })

		expect(title).toHaveAttribute("aria-invalid", "true")
		expect(screen.getByText(/not supported/i)).toBeInTheDocument()
	})
})
