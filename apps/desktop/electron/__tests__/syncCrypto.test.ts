import {
	configureSyncRuntime,
	createShareKey,
	decodeShareKey,
	encodeRecoveryKey,
	encodeShareKey,
	generateX25519KeyPair,
	openSealedVaultKey,
	openShareBundle,
	parseRecoveryKey,
	sealShareBundle,
	sealVaultKey,
	syncRuntime,
	unwrapShareKey,
	unwrapWithRecoveryKey,
	utf8Decode,
	utf8Encode,
	wrapWithRecoveryKey,
} from "@cortex/sync-engine"
import { beforeAll, describe, expect, it } from "vitest"
import { nodeSyncRuntime } from "../platform/nodeSyncRuntime"

beforeAll(() => configureSyncRuntime(nodeSyncRuntime))

const randomKey = () => syncRuntime().crypto.randomBytes(32)
const bytes = (value: Uint8Array) => Uint8Array.from(value)

describe("password key derivation", () => {
	it("keeps argon2id output compatible with keys derived by previous releases", async () => {
		const derived = await syncRuntime().crypto.argon2id("correct horse battery staple", {
			memoryCost: 19456,
			timeCost: 2,
			parallelism: 1,
			hashLength: 32,
			salt: utf8Encode("cortex-vault-salt-0001"),
		})

		expect(Buffer.from(derived).toString("hex")).toBe(
			"fcb1a9e9149052fffe1229ec5254feed545d4980bc65376044e0e6c90aa8d1b7",
		)
	})
})

describe("vault key sealing", () => {
	it("opens a sealed vault key only with the recipient private key", () => {
		const vek = randomKey()
		const recipient = generateX25519KeyPair()
		const stranger = generateX25519KeyPair()

		const sealed = sealVaultKey(vek, recipient.publicKey)

		expect(bytes(openSealedVaultKey(sealed, recipient.privateKey))).toEqual(bytes(vek))
		expect(() => openSealedVaultKey(sealed, stranger.privateKey)).toThrow()
	})

	it("rejects a tampered sealed key", () => {
		const recipient = generateX25519KeyPair()
		const sealed = sealVaultKey(randomKey(), recipient.publicKey)
		sealed[sealed.length - 1] = (sealed[sealed.length - 1] ?? 0) ^ 1

		expect(() => openSealedVaultKey(sealed, recipient.privateKey)).toThrow()
	})
})

describe("recovery key", () => {
	it("round-trips through its printable form and unwraps the private key", () => {
		const recoveryKey = randomKey()
		const { privateKey } = generateX25519KeyPair()

		const parsed = parseRecoveryKey(encodeRecoveryKey(recoveryKey))
		const wrapped = wrapWithRecoveryKey(privateKey, recoveryKey)

		expect(bytes(parsed)).toEqual(bytes(recoveryKey))
		expect(bytes(unwrapWithRecoveryKey(wrapped, parsed))).toEqual(bytes(privateKey))
		expect(() => unwrapWithRecoveryKey(wrapped, randomKey())).toThrow()
	})
})

describe("share links", () => {
	it("unwraps the share key with the vault key and opens the bundle", async () => {
		const vek = randomKey()
		const { key, wrappedKey } = createShareKey(vek)
		const note = utf8Encode("# Shared note\n\nsecret content\n")

		const sealed = await sealShareBundle(note, key)
		const linkKey = decodeShareKey(encodeShareKey(unwrapShareKey(wrappedKey, vek)))

		expect(utf8Decode(await openShareBundle(sealed, linkKey))).toBe(
			"# Shared note\n\nsecret content\n",
		)
		await expect(openShareBundle(sealed, randomKey())).rejects.toThrow()
	})
})
