import "@testing-library/jest-dom"
import { vi } from "vitest"

class MockResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

vi.stubGlobal("ResizeObserver", MockResizeObserver)
Element.prototype.scrollIntoView = vi.fn()
Element.prototype.scrollTo = vi.fn()

vi.mock("@cortex/platform", () => ({
	getPlatform: vi.fn(() => ({
		fs: {
			readFile: vi.fn().mockResolvedValue(""),
			readFileSnapshot: vi.fn().mockResolvedValue({
				content: "",
				hash: "abc123",
				metadata: { createdAt: 0, modifiedAt: 0 },
			}),
			readBinaryFile: vi.fn().mockResolvedValue([37, 80, 68, 70]),
			writeFile: vi.fn().mockResolvedValue(undefined),
			hashFile: vi.fn().mockResolvedValue("abc123"),
			getFileMetadata: vi.fn().mockResolvedValue({ createdAt: 0, modifiedAt: 0 }),
		},
		storage: {
			getAppDataDir: vi.fn().mockResolvedValue("/mock"),
			getVaultConfigDir: vi.fn().mockResolvedValue("/mock/.cortex"),
		},
		notifications: {
			getCapabilities: vi.fn(() => ({
				supported: true,
				icons: false,
				sounds: true,
				actions: false,
			})),
			getPermission: vi.fn().mockResolvedValue("granted"),
			requestPermission: vi.fn().mockResolvedValue("granted"),
			send: vi.fn().mockResolvedValue({ delivered: true }),
		},
		app: {
			getCurrentAppVersion: vi.fn().mockResolvedValue("0.1.0"),
			openExternalUrl: vi.fn().mockResolvedValue(undefined),
			resolveFileAssetUrl: vi.fn((path: string) => `asset://${path}`),
			onDeepLinkOpen: vi.fn().mockResolvedValue(() => {}),
		},
		appUpdates: {
			getStatus: vi.fn().mockResolvedValue({
				state: "idle",
				currentVersion: "0.1.0",
				pendingUpdate: null,
				lastCheckedAt: null,
				lastError: null,
				downloaded: 0,
				contentLength: null,
			}),
			checkForUpdate: vi.fn().mockResolvedValue({
				state: "up-to-date",
				currentVersion: "0.1.0",
				pendingUpdate: null,
				lastCheckedAt: "2026-06-21T00:00:00Z",
				lastError: null,
				downloaded: 0,
				contentLength: null,
			}),
			installUpdate: vi.fn().mockResolvedValue({
				state: "installed",
				currentVersion: "0.1.0",
				pendingUpdate: null,
				lastCheckedAt: "2026-06-21T00:00:00Z",
				lastError: null,
				downloaded: 0,
				contentLength: null,
			}),
			fetchChangelog: vi.fn().mockResolvedValue(null),
		},
		capabilities: ["notifications"],
	})),
	initPlatform: vi.fn(),
}))

vi.mock("@tauri-apps/api/core", () => ({
	invoke: vi.fn(),
}))

vi.mock("@tauri-apps/api/event", () => ({
	listen: vi.fn().mockResolvedValue(() => {}),
	emit: vi.fn(),
}))
