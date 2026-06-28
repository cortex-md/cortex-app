import { getPlatform } from "@cortex/platform"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useVaultStore } from "../../stores/vaultStore"

function setMemoryPlatform() {
	const files = new Map<string, string>()
	const readFile = vi.fn(async (path: string) => {
		const content = files.get(path)
		if (content === undefined) throw new Error("File not found")
		return content
	})
	const writeFile = vi.fn(async (path: string, content: string) => {
		files.set(path, content)
	})
	const scanVault = vi.fn(async (vaultPath: string) => {
		return Array.from(files.keys()).flatMap((path) => {
			if (!path.startsWith(`${vaultPath}/`) || path.includes("/.cortex/")) return []
			return [{ path, name: path.split("/").pop() ?? path, isDir: false }]
		})
	})

	vi.mocked(getPlatform).mockReturnValue({
		fs: {
			readFile,
			writeFile,
			createDir: vi.fn().mockResolvedValue(undefined),
			hashFile: vi.fn().mockResolvedValue("hash"),
			startWatching: vi.fn().mockResolvedValue(vi.fn()),
		},
		storage: {
			getVaultConfigDir: vi.fn(async (vaultPath: string) => `${vaultPath}/.cortex`),
		},
		vault: {
			openVault: vi.fn().mockResolvedValue({
				uuid: "vault-id",
				path: "/vault",
				name: "Vault",
				fileCount: 0,
			}),
			scanVault,
			updateVaultRegistry: vi.fn().mockResolvedValue(undefined),
			readVaultRegistry: vi.fn().mockResolvedValue([]),
			refreshMenuRecents: vi.fn().mockResolvedValue(undefined),
		},
		sync: {
			updateSyncPreferences: vi.fn().mockResolvedValue(undefined),
		},
	} as never)

	return { files, scanVault }
}

beforeEach(() => {
	useVaultStore.setState({
		vault: null,
		files: [],
		recentVaults: [],
		loading: false,
		error: null,
		stopWatcher: null,
		pendingOnboardingNotePath: null,
	})
	vi.clearAllMocks()
})

describe("vaultStore onboarding", () => {
	it("creates the onboarding note before scanning a newly created vault", async () => {
		const { files, scanVault } = setMemoryPlatform()

		await useVaultStore
			.getState()
			.openVault("/vault", { name: "Vault", createOnboardingNote: true })

		expect(scanVault).toHaveBeenCalledWith("/vault")
		expect(useVaultStore.getState().pendingOnboardingNotePath).toBe("/vault/Welcome to Cortex.md")
		expect(useVaultStore.getState().files).toEqual([
			{ path: "/vault/Welcome to Cortex.md", name: "Welcome to Cortex.md", isDir: false },
		])
		expect(files.get("/vault/Welcome to Cortex.md")).toContain("# Welcome to Cortex")
	})
})
