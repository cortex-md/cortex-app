import { beforeEach, describe, expect, it, vi } from "vitest"
import { AppUpdates } from "../AppUpdates"

interface TestChannel<T> {
	onmessage?: (event: T) => void
}

const tauriCoreMock = vi.hoisted(() => ({
	channels: [] as TestChannel<unknown>[],
	invoke: vi.fn(),
}))

vi.mock("@tauri-apps/api/core", () => ({
	Channel: class<T> {
		onmessage?: (event: T) => void

		constructor() {
			tauriCoreMock.channels.push(this as TestChannel<unknown>)
		}
	},
	invoke: tauriCoreMock.invoke,
}))

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
		tauriCoreMock.channels = []
		tauriCoreMock.invoke.mockReset()
		tauriCoreMock.invoke.mockResolvedValue(availableStatus)
	})

	it("gets updater status from the Rust command", async () => {
		const updates = new AppUpdates()

		await expect(updates.getStatus()).resolves.toBe(availableStatus)

		expect(tauriCoreMock.invoke).toHaveBeenCalledWith("app_update_status")
	})

	it("checks updates with the requested source", async () => {
		const updates = new AppUpdates()

		await updates.checkForUpdate({ source: "manual" })

		expect(tauriCoreMock.invoke).toHaveBeenCalledWith("app_update_check", { source: "manual" })
	})

	it("bridges install progress through a Tauri channel", async () => {
		const updates = new AppUpdates()
		const onEvent = vi.fn()
		tauriCoreMock.invoke.mockImplementation(async (_command, args) => {
			args.onEvent.onmessage({
				event: "progress",
				data: {
					chunkLength: 512,
					downloaded: 512,
					contentLength: 1024,
				},
			})
			return availableStatus
		})

		await expect(updates.installUpdate(onEvent)).resolves.toBe(availableStatus)

		expect(tauriCoreMock.invoke).toHaveBeenCalledWith("app_update_install", {
			onEvent: tauriCoreMock.channels[0],
		})
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
		tauriCoreMock.invoke.mockResolvedValue("# Changes")

		await expect(updates.fetchChangelog("0.1.1")).resolves.toBe("# Changes")

		expect(tauriCoreMock.invoke).toHaveBeenCalledWith("app_update_fetch_changelog", {
			version: "0.1.1",
		})
	})
})
