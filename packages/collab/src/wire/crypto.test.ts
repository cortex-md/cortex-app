import { describe, expect, it } from "vitest"
import {
	COLLAB_ENVELOPE_OVERHEAD,
	deriveCollabKey,
	openCollabPayload,
	sealCollabPayload,
} from "./crypto"

const vaultKey = Uint8Array.from({ length: 32 }, (_, index) => index)
const payload = new TextEncoder().encode("yjs update")

describe("collab envelope", () => {
	it("round-trips a payload sealed for a vault", () => {
		const key = deriveCollabKey(vaultKey)
		const envelope = sealCollabPayload(key, "vault-a", payload)
		expect(envelope.length).toBe(payload.length + COLLAB_ENVELOPE_OVERHEAD)
		expect(openCollabPayload(key, "vault-a", envelope)).toEqual(payload)
	})

	it("rejects envelopes opened with another vault id or key", () => {
		const key = deriveCollabKey(vaultKey)
		const envelope = sealCollabPayload(key, "vault-a", payload)
		expect(() => openCollabPayload(key, "vault-b", envelope)).toThrow()
		expect(() =>
			openCollabPayload(deriveCollabKey(new Uint8Array(32)), "vault-a", envelope),
		).toThrow()
	})

	it("rejects truncated or unknown envelope versions", () => {
		const key = deriveCollabKey(vaultKey)
		const envelope = sealCollabPayload(key, "vault-a", payload)
		expect(() => openCollabPayload(key, "vault-a", envelope.subarray(0, 4))).toThrow()
		const tampered = Uint8Array.from(envelope)
		tampered[0] = 0x02
		expect(() => openCollabPayload(key, "vault-a", tampered)).toThrow()
	})
})
