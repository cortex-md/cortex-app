import { beforeEach, describe, expect, it, vi } from "vitest"
import { AppUpdates } from "../AppUpdates"
import { cortexBridgeMock, installCortexBridgeMock, resetCortexBridgeMock } from "./bridgeTestUtils"

const availableStatus = {
	state: "available",
	currentVersion: "0.1.0",
	pendingUpdate: {
		version: "0.1.1",
		currentVersion: "0.1.0",
		body: "# Changes",
		date: "2026-06-21T00:00:00Z",
		target: "darwin-aarch64",
	},
	lastCheckedAt: "2026-06-21T00:00:00Z",
	lastError: null,
	downloaded: 0,
	contentLength: null,
}

describe("AppUpdates IPC adapter", () => {
	beforeEach(() => {
		installCortexBridgeMock()
		resetCortexBridgeMock()
		cortexBridgeMock.invoke.mockResolvedValue(availableStatus)
	})

	it("gets updater status from the native command", async () => {
		const updates = new AppUpdates()

		await expect(updates.getStatus()).resolves.toBe(availableStatus)
		expect(cortexBridgeMock.invoke).toHaveBeenCalledWith("app_update_status", {})
	})

	it("checks updates with the requested source", async () => {
		const updates = new AppUpdates()

		await updates.checkForUpdate({ source: "manual" })

		expect(cortexBridgeMock.invoke).toHaveBeenCalledWith("app_update_check", { source: "manual" })
	})

	it("bridges install progress through a native event", async () => {
		const updates = new AppUpdates()
		const onEvent = vi.fn()
		cortexBridgeMock.on.mockImplementation(
			(_event: string, listener: (payload: unknown) => void) => {
				listener({
					event: "progress",
					data: {
						chunkLength: 512,
						downloaded: 512,
						contentLength: 1024,
					},
				})
				return () => {}
			},
		)

		await expect(updates.installUpdate(onEvent)).resolves.toBe(availableStatus)
		expect(cortexBridgeMock.invoke).toHaveBeenCalledWith("app_update_install", {})
		expect(onEvent).toHaveBeenCalledWith({
			event: "progress",
			data: {
				chunkLength: 512,
				downloaded: 512,
				contentLength: 1024,
			},
		})
	})

	it("fetches changelog markdown by version", async () => {
		const updates = new AppUpdates()
		cortexBridgeMock.invoke.mockResolvedValue("# Changes")

		await expect(updates.fetchChangelog("0.1.1")).resolves.toBe("# Changes")
		expect(cortexBridgeMock.invoke).toHaveBeenCalledWith("app_update_fetch_changelog", {
			version: "0.1.1",
		})
	})
})
