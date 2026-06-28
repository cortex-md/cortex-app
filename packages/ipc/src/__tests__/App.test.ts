import { beforeEach, describe, expect, it, vi } from "vitest"
import { App } from "../App"

const appMock = vi.hoisted(() => ({
	getVersion: vi.fn(),
}))

const coreMock = vi.hoisted(() => ({
	convertFileSrc: vi.fn(),
}))

const deepLinkMock = vi.hoisted(() => ({
	onOpenUrl: vi.fn(),
}))

const openerMock = vi.hoisted(() => ({
	openUrl: vi.fn(),
}))

vi.mock("@tauri-apps/api/app", () => ({
	getVersion: appMock.getVersion,
}))

vi.mock("@tauri-apps/api/core", () => ({
	convertFileSrc: coreMock.convertFileSrc,
}))

vi.mock("@tauri-apps/plugin-deep-link", () => ({
	onOpenUrl: deepLinkMock.onOpenUrl,
}))

vi.mock("@tauri-apps/plugin-opener", () => ({
	openUrl: openerMock.openUrl,
}))

describe("App IPC adapter", () => {
	beforeEach(() => {
		appMock.getVersion.mockReset()
		coreMock.convertFileSrc.mockReset()
		deepLinkMock.onOpenUrl.mockReset()
		openerMock.openUrl.mockReset()
	})

	it("subscribes to runtime deep link URLs", async () => {
		const unlisten = vi.fn()
		const listener = vi.fn()
		deepLinkMock.onOpenUrl.mockImplementation(async (callback: (urls: string[]) => void) => {
			callback(["cortex://sync/checkout-complete"])
			return unlisten
		})

		const app = new App()

		await expect(app.onDeepLinkOpen(listener)).resolves.toBe(unlisten)
		expect(listener).toHaveBeenCalledWith(["cortex://sync/checkout-complete"])
	})
})
