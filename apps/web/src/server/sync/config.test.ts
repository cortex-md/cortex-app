import { describe, expect, it } from "vitest"
import {
	getBillingCompletionUrl,
	getBillingReturnUrl,
	getSiteBaseUrl,
	getSyncBaseUrl,
	normalizeHttpBaseUrl,
} from "./config"

describe("Sync runtime config", () => {
	it("uses the local Sync server by default", () => {
		expect(getSyncBaseUrl({})).toBe("http://localhost:8080")
	})

	it("normalizes configured HTTP base URLs", () => {
		expect(normalizeHttpBaseUrl(" https://sync.example.com///?x=1#token ", "fallback")).toBe(
			"https://sync.example.com",
		)
		expect(normalizeHttpBaseUrl("ftp://sync.example.com", "fallback")).toBe("fallback")
		expect(normalizeHttpBaseUrl("not-a-url", "fallback")).toBe("fallback")
	})

	it("derives billing callback defaults from SITE_URL", () => {
		const env = { SITE_URL: "http://localhost:3001/" }

		expect(getSiteBaseUrl(env)).toBe("http://localhost:3001")
		expect(getBillingReturnUrl(env)).toBe("http://localhost:3001/billing/cancelled")
		expect(getBillingCompletionUrl({})).toBe("cortex://sync/checkout-complete")
	})

	it("accepts explicit billing callback URLs", () => {
		expect(
			getBillingReturnUrl({
				CORTEX_BILLING_RETURN_URL: "https://app.example.com/billing/cancelled",
			}),
		).toBe("https://app.example.com/billing/cancelled")
		expect(
			getBillingCompletionUrl({
				CORTEX_BILLING_COMPLETION_URL: "https://app.example.com/billing/success",
			}),
		).toBe("https://app.example.com/billing/success")
	})
})
