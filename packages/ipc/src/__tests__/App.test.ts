import { beforeEach, describe, expect, it, vi } from "vitest"
import { App } from "../App"
import { cortexBridgeMock, installCortexBridgeMock, resetCortexBridgeMock } from "./bridgeTestUtils"

describe("App IPC adapter", () => {
	beforeEach(() => {
		installCortexBridgeMock()
		resetCortexBridgeMock()
	})

	it("subscribes to runtime deep link URLs", async () => {
		const unlisten = vi.fn()
		const listener = vi.fn()
		cortexBridgeMock.on.mockImplementation((_event: string, callback: (urls: string[]) => void) => {
			callback(["cortex://sync/checkout-complete"])
			return unlisten
		})

		const app = new App()

		await expect(app.onDeepLinkOpen(listener)).resolves.toBe(unlisten)
		expect(listener).toHaveBeenCalledWith(["cortex://sync/checkout-complete"])
	})

	it("resolves vault assets through the cortex-file protocol", () => {
		const app = new App()
		expect(app.resolveFileAssetUrl("/Users/me/note.png")).toBe("cortex-file://local/Users/me/note.png")
	})
})
