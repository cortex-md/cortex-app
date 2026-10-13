import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const fetchOverview = vi.fn()
const setAccessRule = vi.fn()
const loadKeyTrustIssues = vi.fn()
const ensureCapabilities = vi.fn()
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
			accessRules: [],
			groups: [],
			overviewVault: null,
			loading: false,
			error: null,
			fetchOverview,
			setAccessRule,
			updateMemberRole,
			removeMember,
			fetchInvites,
			createInvite,
			deleteInvite,
			clearError,
		}
		return selector ? selector(state) : state
	},
	useAccountStore: (selector: (state: unknown) => unknown) => selector({ ensureCapabilities }),
	useServerCapabilities: () => null,
	useSyncStore: (selector: (state: unknown) => unknown) =>
		selector({ keyTrustIssues: [], loadKeyTrustIssues, trustMemberKey: vi.fn() }),
}))

import { getPlatform } from "@cortex/platform"
import { MembersPanel } from "../../../features/sync/MembersPanel"

beforeEach(() => {
	vi.mocked(getPlatform).mockReturnValue({
		dialog: { showConfirm: vi.fn().mockResolvedValue(true) },
	} as never)
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("MembersPanel", () => {
	it("shows member hierarchy and updates roles through the role menu", async () => {
		render(<MembersPanel vaultId="vault-id" currentUserRole="owner" />)

		expect(screen.getByText("Ada Lovelace")).toBeInTheDocument()
		expect(screen.getByText(/ada@example\.com/)).toBeInTheDocument()
		expect(screen.getByText("AL")).toBeInTheDocument()

		await userEvent.click(screen.getByRole("button", { name: "Role for Ada Lovelace" }))
		await userEvent.click(await screen.findByRole("menuitemradio", { name: "Editor" }))

		expect(updateMemberRole).toHaveBeenCalledWith("vault-id", "user-1", "editor")

		await userEvent.click(screen.getByRole("button", { name: "More actions for Ada Lovelace" }))
		await userEvent.click(await screen.findByRole("menuitem", { name: "Remove from vault" }))
		await userEvent.click(await screen.findByRole("button", { name: "Remove" }))
		await waitFor(() => expect(removeMember).toHaveBeenCalledWith("vault-id", "user-1"))
	})

	it("sends invitations with a selected role and exposes pending invite actions", async () => {
		createInvite.mockResolvedValue(undefined)
		render(<MembersPanel vaultId="vault-id" currentUserRole="owner" />)

		await userEvent.type(
			screen.getByRole("textbox", { name: "Email to invite" }),
			"new@example.com",
		)
		await userEvent.click(screen.getByRole("button", { name: "Role for the invite" }))
		await userEvent.click(await screen.findByRole("menuitemradio", { name: "Viewer" }))
		await userEvent.click(screen.getByRole("button", { name: "Invite" }))

		await waitFor(() => {
			expect(createInvite).toHaveBeenCalledWith("vault-id", "new@example.com", "viewer", "")
		})
		expect(screen.getByText("grace@example.com")).toBeInTheDocument()

		await userEvent.click(
			screen.getByRole("button", { name: "Cancel invite for grace@example.com" }),
		)
		await userEvent.click(await screen.findByRole("button", { name: "Cancel invite" }))
		await waitFor(() => expect(deleteInvite).toHaveBeenCalledWith("vault-id", "invite-1"))
	})
})
