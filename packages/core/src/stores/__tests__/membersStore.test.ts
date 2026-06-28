import { getPlatform } from "@cortex/platform"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAuthStore } from "../../stores/authStore"
import { useMembersStore } from "../../stores/membersStore"

beforeEach(() => {
	vi.clearAllMocks()
	useAuthStore.setState({
		checkAuth: vi.fn().mockResolvedValue(undefined),
	})
	useMembersStore.setState({
		members: [],
		memberCache: {},
		activeMemberCacheKey: null,
		loading: false,
		error: null,
	})
})

describe("membersStore", () => {
	it("deduplicates concurrent member loads by server and vault", async () => {
		const members = [
			{
				vaultId: "vault-id",
				userId: "user-id",
				email: "ada@example.com",
				displayName: "Ada",
				role: "editor",
				joinedAt: "2026-06-01T00:00:00.000Z",
			},
		]
		let resolveMembers: (value: typeof members) => void = () => undefined
		const listMembers = vi.fn(
			() =>
				new Promise<typeof members>((resolve) => {
					resolveMembers = resolve
				}),
		)
		vi.mocked(getPlatform).mockReturnValue({
			members: { listMembers },
		} as never)

		const firstLoad = useMembersStore
			.getState()
			.ensureMembers("vault-id", "https://sync.example.com/")
		const secondLoad = useMembersStore
			.getState()
			.ensureMembers("vault-id", "https://sync.example.com")

		await vi.waitFor(() => expect(listMembers).toHaveBeenCalledTimes(1))
		resolveMembers(members)

		await expect(Promise.all([firstLoad, secondLoad])).resolves.toEqual([members, members])
		await expect(
			useMembersStore.getState().ensureMembers("vault-id", "https://sync.example.com"),
		).resolves.toEqual(members)
		expect(listMembers).toHaveBeenCalledTimes(1)
	})
})
