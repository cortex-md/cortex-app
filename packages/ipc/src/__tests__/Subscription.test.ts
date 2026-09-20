import { beforeEach, describe, expect, it } from "vitest"
import { Subscription } from "../Subscription"
import { cortexBridgeMock, installCortexBridgeMock, resetCortexBridgeMock } from "./bridgeTestUtils"

describe("Subscription IPC adapter", () => {
	beforeEach(() => {
		installCortexBridgeMock()
		resetCortexBridgeMock()
	})

	it("gets subscription status from the native command", async () => {
		const status = {
			status: "active",
			entitled: true,
			currentPeriodStart: null,
			currentPeriodEnd: null,
			entitlementExpiresAt: null,
			billingCycle: "MONTHLY",
			planProductId: "price_test",
		}
		cortexBridgeMock.invoke.mockResolvedValue(status)

		const subscription = new Subscription()

		await expect(subscription.getStatus("https://sync.example.com")).resolves.toBe(status)
		expect(cortexBridgeMock.invoke).toHaveBeenCalledWith("subscription_get_status", {
			serverUrl: "https://sync.example.com",
		})
	})
})
