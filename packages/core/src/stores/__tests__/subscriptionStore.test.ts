import { getPlatform } from "@cortex/platform"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useSubscriptionStore } from "../../stores/subscriptionStore"
import { BILLING_URL } from "../../sync/serverConfig"

const openExternalUrl = vi.fn().mockResolvedValue(undefined)
const getStatus = vi.fn()

beforeEach(() => {
	vi.clearAllMocks()
	useSubscriptionStore.setState({
		statusByServer: {},
		loading: false,
		error: null,
		block: null,
	})
	vi.mocked(getPlatform).mockReturnValue({
		app: {
			openExternalUrl,
		},
		subscription: {
			getStatus,
		},
	} as never)
})

describe("subscriptionStore", () => {
	it("opens the configured web billing page without creating checkout sessions", async () => {
		await expect(useSubscriptionStore.getState().openBillingPage()).resolves.toBe(BILLING_URL)

		expect(openExternalUrl).toHaveBeenCalledWith(BILLING_URL)
		expect(getStatus).not.toHaveBeenCalled()
	})
})
