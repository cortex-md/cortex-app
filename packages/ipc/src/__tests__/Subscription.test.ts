import { beforeEach, describe, expect, it, vi } from "vitest"
import { Subscription } from "../Subscription"

const tauriCoreMock = vi.hoisted(() => ({
	invoke: vi.fn(),
}))

vi.mock("@tauri-apps/api/core", () => ({
	invoke: tauriCoreMock.invoke,
}))

describe("Subscription IPC adapter", () => {
	beforeEach(() => {
		tauriCoreMock.invoke.mockReset()
	})

	it("gets subscription status from the Rust command", async () => {
		const status = {
			status: "active",
			entitled: true,
			currentPeriodStart: null,
			currentPeriodEnd: null,
			entitlementExpiresAt: null,
			billingCycle: "MONTHLY",
			planProductId: "price_test",
		}
		tauriCoreMock.invoke.mockResolvedValue(status)

		const subscription = new Subscription()

		await expect(subscription.getStatus("https://sync.example.com")).resolves.toBe(status)
		expect(tauriCoreMock.invoke).toHaveBeenCalledWith("subscription_get_status", {
			serverUrl: "https://sync.example.com",
		})
	})
})
