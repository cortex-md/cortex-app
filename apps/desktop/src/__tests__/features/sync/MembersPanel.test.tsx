import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const fetchMembers = vi.fn()
const updateMemberRole = vi.fn()
const removeMember = vi.fn()
const fetchInvites = vi.fn()
const createInvite = vi.fn()
const deleteInvite = vi.fn()
const clearError = vi.fn()

const members = [
	{
		vaultId: "vault-id",
		userId: "user-1",
		email: "ada@example.com",
		displayName: "Ada Lovelace",
		role: "admin",
		joinedAt: "2026-05-01T12:00:00Z",
	},
]

const invites = [
	{
		id: "invite-1",
		vaultId: "vault-id",
		vaultName: "Team Notes",
		inviterId: "owner-1",
		inviteeEmail: "grace@example.com",
		role: "viewer",
		encryptedVaultKey: null,
		accepted: false,
		expiresAt: "2026-07-01T12:00:00Z",
		createdAt: "2026-06-01T12:00:00Z",
	},
]

vi.mock("@cortex/core", () => ({
	useMembersStore: (selector?: (state: unknown) => unknown) => {
		const state = {
			members,
			invites,
			loading: false,
			error: null,
			fetchMembers,
			updateMemberRole,
			removeMember,
			fetchInvites,
			createInvite,
			deleteInvite,
			clearError,
		}
		return selector ? selector(state) : state
	},
}))

import { MembersPanel } from "../../../features/sync/MembersPanel"

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("MembersPanel", () => {
	it("shows member hierarchy and updates roles through a native select", async () => {
		render(<MembersPanel vaultId="vault-id" currentUserRole="owner" />)

		expect(screen.getByText("Ada Lovelace")).toBeInTheDocument()
		expect(screen.getByText("ada@example.com")).toBeInTheDocument()
		expect(screen.getByText("AL")).toBeInTheDocument()
		expect(screen.getByRole("columnheader", { name: "Joined" })).toBeInTheDocument()

		fireEvent.change(screen.getByRole("combobox", { name: "Role for Ada Lovelace" }), {
			target: { value: "editor" },
		})

		expect(updateMemberRole).toHaveBeenCalledWith("vault-id", "user-1", "editor")

		await userEvent.click(screen.getByRole("button", { name: "Remove Ada Lovelace" }))
		expect(removeMember).toHaveBeenCalledWith("vault-id", "user-1")
	})

	it("sends invitations with a selected role and exposes pending invite actions", async () => {
		createInvite.mockResolvedValue(undefined)
		render(<MembersPanel vaultId="vault-id" currentUserRole="owner" />)

		await userEvent.type(screen.getByRole("textbox", { name: "Invite email" }), "new@example.com")
		fireEvent.change(screen.getByRole("combobox", { name: "Invite role" }), {
			target: { value: "viewer" },
		})
		await userEvent.click(screen.getByRole("button", { name: "Send invite" }))

		await waitFor(() => {
			expect(createInvite).toHaveBeenCalledWith("vault-id", "new@example.com", "viewer", "")
		})
		expect(screen.getByText("grace@example.com")).toBeInTheDocument()

		await userEvent.click(
			screen.getByRole("button", { name: "Cancel invite for grace@example.com" }),
		)
		expect(deleteInvite).toHaveBeenCalledWith("vault-id", "invite-1")
	})
})
