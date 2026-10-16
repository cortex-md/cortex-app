import { ACCOUNT_KDF, DEFAULT_KDF } from "@cortex/sync-api"
import { describe, expect, it } from "vitest"

describe("account key derivation parameters", () => {
	it("keeps the prelogin defaults aligned with the derivation constants", () => {
		expect(DEFAULT_KDF).toEqual({
			algorithm: ACCOUNT_KDF.algorithm,
			memoryKib: ACCOUNT_KDF.memoryKib,
			iterations: ACCOUNT_KDF.iterations,
			parallelism: ACCOUNT_KDF.parallelism,
		})
	})
})
