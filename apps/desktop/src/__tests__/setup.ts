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

const { idleUpdateStatus } = vi.hoisted(() => ({
	idleUpdateStatus: {
		state: "idle",
		currentVersion: "0.1.0",
		pendingUpdate: null,
		lastCheckedAt: null,
		lastError: null,
		installMode: "automatic",
		installOnQuit: true,
		downloaded: 0,
		contentLength: null,
	},
}))

vi.mock("@cortex/platform", () => ({
	getPlatform: vi.fn(() => ({
		clipboard: {
			writeText: vi.fn((text: string) => navigator.clipboard.writeText(text)),
			readText: vi.fn(() => navigator.clipboard.readText()),
		},
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
			onNativeEvent: vi.fn().mockResolvedValue(() => {}),
		},
		appUpdates: {
			getStatus: vi.fn().mockResolvedValue(idleUpdateStatus),
			configure: vi.fn().mockResolvedValue(idleUpdateStatus),
			checkForUpdate: vi.fn().mockResolvedValue({
				...idleUpdateStatus,
				state: "up-to-date",
				lastCheckedAt: "2026-06-21T00:00:00Z",
			}),
			downloadUpdate: vi.fn().mockResolvedValue(idleUpdateStatus),
			installNow: vi.fn().mockResolvedValue(idleUpdateStatus),
			setInstallOnQuit: vi.fn().mockResolvedValue(idleUpdateStatus),
			fetchChangelog: vi.fn().mockResolvedValue(null),
			onStatusChanged: vi.fn(() => () => {}),
			onBeforeInstall: vi.fn(() => () => {}),
		},
		capabilities: ["notifications"],
	})),
	initPlatform: vi.fn(),
}))
