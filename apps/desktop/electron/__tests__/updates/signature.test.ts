import { describe, expect, it } from "vitest"
import { UpdateError } from "../../updates/errors"
import { isTrustedReleaseUrl } from "../../updates/manifest"
import { importPublicKey, verifyManifestSignature } from "../../updates/signature"
import {
	type FetchLike,
	fetchSignedManifest,
	isTrustedResponseUrl,
	pickManifestLocation,
} from "../../updates/source"
import { createTestKeys, manifestJson, signManifest } from "./fixtures"

const keys = createTestKeys()
const otherKeys = createTestKeys()

function codeOf(run: () => unknown): string | null {
	try {
		run()
		return null
	} catch (error) {
		return error instanceof UpdateError ? error.code : "UNEXPECTED"
	}
}

describe("manifest signature", () => {
	const text = manifestJson()
	const bytes = new TextEncoder().encode(text)

	it("accepts a signature from the embedded key", () => {
		expect(() =>
			verifyManifestSignature(bytes, signManifest(text, keys.privateKey), keys.publicKey),
		).not.toThrow()
	})

	it("rejects a tampered manifest", () => {
		const tampered = new TextEncoder().encode(text.replace("1.4.0", "1.4.1"))
		expect(
			codeOf(() =>
				verifyManifestSignature(tampered, signManifest(text, keys.privateKey), keys.publicKey),
			),
		).toBe("SIGNATURE_INVALID")
	})

	it("rejects a signature made with another key", () => {
		expect(
			codeOf(() =>
				verifyManifestSignature(bytes, signManifest(text, otherKeys.privateKey), keys.publicKey),
			),
		).toBe("SIGNATURE_INVALID")
	})

	it("rejects truncated or garbage signatures", () => {
		expect(codeOf(() => verifyManifestSignature(bytes, "", keys.publicKey))).toBe(
			"SIGNATURE_INVALID",
		)
		expect(codeOf(() => verifyManifestSignature(bytes, "bm90IGEgc2ln", keys.publicKey))).toBe(
			"SIGNATURE_INVALID",
		)
	})

	it("imports only Ed25519 SPKI keys", () => {
		const spki = keys.publicKey.export({ format: "der", type: "spki" }).toString("base64")
		expect(importPublicKey(spki).asymmetricKeyType).toBe("ed25519")
		expect(() => importPublicKey("AAAA")).toThrow()
	})
})

function fakeFetch(files: Record<string, string>): FetchLike & { calls: string[] } {
	const calls: string[] = []
	const fetcher = async (url: string) => {
		calls.push(url)
		const body = files[url]
		if (body === undefined) return new Response("missing", { status: 404 })
		return new Response(body, { status: 200 })
	}
	return Object.assign(fetcher, { calls })
}

const STABLE_MANIFEST =
	"https://github.com/cortex-md/cortex-app/releases/latest/download/latest.json"

describe("signed manifest source", () => {
	const text = manifestJson()
	const options = (fetch: FetchLike) => ({
		channel: "stable" as const,
		fetch,
		publicKey: keys.publicKey,
		allowUrl: isTrustedReleaseUrl,
		allowResponseUrl: isTrustedResponseUrl,
	})

	it("returns the manifest once the signature matches", async () => {
		const fetch = fakeFetch({
			[STABLE_MANIFEST]: text,
			[`${STABLE_MANIFEST}.sig`]: signManifest(text, keys.privateKey),
		})
		await expect(fetchSignedManifest(options(fetch))).resolves.toMatchObject({ version: "1.4.0" })
	})

	it("rejects an invalid signature before parsing any field", async () => {
		const fetch = fakeFetch({
			[STABLE_MANIFEST]: "{ not json",
			[`${STABLE_MANIFEST}.sig`]: signManifest(text, keys.privateKey),
		})
		await expect(fetchSignedManifest(options(fetch))).rejects.toMatchObject({
			code: "SIGNATURE_INVALID",
		})
	})

	it("reports missing files as network errors", async () => {
		await expect(fetchSignedManifest(options(fakeFetch({})))).rejects.toMatchObject({
			code: "NETWORK",
		})
	})

	it("rejects a beta manifest served on the stable channel", async () => {
		const beta = manifestJson({ version: "1.5.0-beta.1", channel: "beta" })
		const fetch = fakeFetch({
			[STABLE_MANIFEST]: beta,
			[`${STABLE_MANIFEST}.sig`]: signManifest(beta, keys.privateKey),
		})
		await expect(fetchSignedManifest(options(fetch))).rejects.toMatchObject({
			code: "MANIFEST_INVALID",
		})
	})

	it("picks the newest non-draft release that carries a manifest for beta", () => {
		const asset = (tag: string, name: string) => ({
			name,
			browser_download_url: `https://github.com/cortex-md/cortex-app/releases/download/${tag}/${name}`,
		})
		const location = pickManifestLocation([
			{ draft: true, assets: [asset("v2.0.0", "latest.json"), asset("v2.0.0", "latest.json.sig")] },
			{ draft: false, assets: [asset("v1.9.0-beta.1", "Cortex.zip")] },
			{
				draft: false,
				assets: [asset("v1.8.0-beta.2", "latest.json"), asset("v1.8.0-beta.2", "latest.json.sig")],
			},
		])
		expect(location?.manifestUrl).toContain("/v1.8.0-beta.2/latest.json")
		expect(pickManifestLocation([])).toBeNull()
	})

	it("only follows redirects to GitHub download hosts", () => {
		expect(isTrustedResponseUrl("https://release-assets.githubusercontent.com/x")).toBe(true)
		expect(isTrustedResponseUrl("https://objects.githubusercontent.com/x")).toBe(true)
		expect(isTrustedResponseUrl("http://objects.githubusercontent.com/x")).toBe(false)
		expect(isTrustedResponseUrl("https://evil.example/x")).toBe(false)
	})
})
