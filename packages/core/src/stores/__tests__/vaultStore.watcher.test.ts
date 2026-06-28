import { getPlatform } from "@cortex/platform"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useVaultStore } from "../../stores/vaultStore"

beforeEach(() => {
	vi.useFakeTimers()
	useVaultStore.setState({
		vault: null,
		files: [],
		recentVaults: [],
		loading: false,
		error: null,
		stopWatcher: null,
	})
	vi.clearAllMocks()
})

afterEach(async () => {
	if (useVaultStore.getState().vault) await useVaultStore.getState().closeVault()
	vi.useRealTimers()
})

describe("vault watcher refresh coordination", () => {
	it("coalesces a burst of file events into one vault scan", async () => {
		let watcherCallback:
			| ((event: { path: string; kind: "created" | "modified" | "deleted" | "renamed" }) => void)
			| undefined
		const scanVault = vi.fn().mockResolvedValue([])
		vi.mocked(getPlatform).mockReturnValue({
			fs: {
				readFile: vi.fn().mockRejectedValue(new Error("No such file")),
				writeFile: vi.fn().mockResolvedValue(undefined),
				startWatching: vi.fn().mockImplementation(async (_path, callback) => {
					watcherCallback = callback
					return vi.fn()
				}),
			},
			vault: {
				openVault: vi.fn().mockResolvedValue({
					uuid: "vault-id",
					path: "/vault",
					name: "Vault",
					fileCount: 0,
				}),
				updateVaultRegistry: vi.fn().mockResolvedValue(undefined),
				scanVault,
				readVaultRegistry: vi.fn().mockResolvedValue([]),
				refreshMenuRecents: vi.fn().mockResolvedValue(undefined),
			},
			sync: {
				updateSyncPreferences: vi.fn().mockResolvedValue(undefined),
			},
		} as never)

		await useVaultStore.getState().openVault("/vault", { name: "Vault" })
		for (let index = 0; index < 100; index++) {
			watcherCallback?.({
				path: `/vault/note-${index}.md`,
				kind: "modified",
			})
		}
		await vi.advanceTimersByTimeAsync(199)
		expect(scanVault).toHaveBeenCalledTimes(1)

		await vi.advanceTimersByTimeAsync(1)
		expect(scanVault).toHaveBeenCalledTimes(2)
	})
})
