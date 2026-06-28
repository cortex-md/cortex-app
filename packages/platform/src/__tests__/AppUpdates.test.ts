import { describe, expect, it } from "vitest"
import type { AppUpdateInstallEvent, AppUpdateStatus } from "../interfaces/AppUpdates"

describe("AppUpdates contract", () => {
	it("describes pending update status with serializable fields", () => {
		const status: AppUpdateStatus = {
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

		expect(status.pendingUpdate?.version).toBe("0.1.1")
		expect(status.state).toBe("available")
	})

	it("describes install progress events", () => {
		const event: AppUpdateInstallEvent = {
			event: "progress",
			data: {
				chunkLength: 512,
				downloaded: 1024,
				contentLength: 2048,
			},
		}

		expect(event.data.downloaded).toBe(1024)
	})
})
