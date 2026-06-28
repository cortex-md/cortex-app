import { vi } from "vitest"

vi.mock("@cortex/platform", () => ({
	getPlatform: vi.fn(() => ({
		fs: {
			readFile: vi.fn().mockResolvedValue(""),
			readFileSnapshot: vi.fn().mockResolvedValue({
				content: "",
				hash: "abc123",
				metadata: { createdAt: 0, modifiedAt: 0 },
			}),
			writeFile: vi.fn().mockResolvedValue(undefined),
			hashFile: vi.fn().mockResolvedValue("abc123"),
			getFileMetadata: vi.fn().mockResolvedValue({ createdAt: 0, modifiedAt: 0 }),
			deleteFile: vi.fn().mockResolvedValue(undefined),
			createDir: vi.fn().mockResolvedValue(undefined),
			startWatching: vi.fn().mockResolvedValue(() => {}),
		},
		storage: {
			getAppDataDir: vi.fn().mockResolvedValue("/mock"),
			getVaultConfigDir: vi.fn().mockResolvedValue("/mock/.cortex"),
		},
		vault: {
			openVault: vi.fn(),
			closeVault: vi.fn(),
			scanVault: vi.fn().mockResolvedValue([]),
			updateVaultRegistry: vi.fn(),
			readVaultRegistry: vi.fn().mockResolvedValue([]),
			refreshMenuRecents: vi.fn().mockResolvedValue(undefined),
		},
		app: {
			getCurrentAppVersion: vi.fn().mockResolvedValue("0.1.0"),
			openExternalUrl: vi.fn().mockResolvedValue(undefined),
			resolveFileAssetUrl: vi.fn((path: string) => `asset://${path}`),
		},
		appUpdates: {
			getStatus: vi.fn(),
			checkForUpdate: vi.fn(),
			installUpdate: vi.fn(),
			fetchChangelog: vi.fn(),
		},
	})),
	initPlatform: vi.fn(),
}))
