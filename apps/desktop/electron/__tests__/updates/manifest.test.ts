import { describe, expect, it } from "vitest"
import { UpdateError } from "../../updates/errors"
import {
	isTrustedReleaseUrl,
	parseManifest,
	selectPlatformPackage,
	toPlatformKey,
} from "../../updates/manifest"
import { manifestJson, releaseUrl } from "./fixtures"

function errorCode(run: () => unknown): string | null {
	try {
		run()
		return null
	} catch (error) {
		return error instanceof UpdateError ? error.code : "UNEXPECTED"
	}
}

describe("update manifest", () => {
	it("parses a valid manifest", () => {
		const manifest = parseManifest(manifestJson())
		expect(manifest.version).toBe("1.4.0")
		expect(manifest.platforms["darwin-arm64"]?.type).toBe("zip")
		expect(manifest.platforms["darwin-x64"]).toBeUndefined()
	})

	it("rejects malformed documents and fields", () => {
		expect(errorCode(() => parseManifest("{"))).toBe("MANIFEST_INVALID")
		expect(errorCode(() => parseManifest("[]"))).toBe("MANIFEST_INVALID")
		expect(errorCode(() => parseManifest(manifestJson({ version: "next" })))).toBe(
			"MANIFEST_INVALID",
		)
		expect(errorCode(() => parseManifest(manifestJson({ channel: "nightly" })))).toBe(
			"MANIFEST_INVALID",
		)
		expect(errorCode(() => parseManifest(manifestJson({ releasedAt: "yesterday" })))).toBe(
			"MANIFEST_INVALID",
		)
		expect(errorCode(() => parseManifest(manifestJson({ platforms: null })))).toBe(
			"MANIFEST_INVALID",
		)
	})

	it("rejects packages with a wrong type, hash or size", () => {
		const entry = { type: "zip", url: releaseUrl("a.zip"), sha256: "b".repeat(64), size: 1 }
		const withEntry = (value: unknown) => manifestJson({ platforms: { "darwin-arm64": value } })
		expect(errorCode(() => parseManifest(withEntry({ ...entry, type: "dmg" })))).toBe(
			"MANIFEST_INVALID",
		)
		expect(errorCode(() => parseManifest(withEntry({ ...entry, sha256: "xyz" })))).toBe(
			"MANIFEST_INVALID",
		)
		expect(errorCode(() => parseManifest(withEntry({ ...entry, size: 0 })))).toBe(
			"MANIFEST_INVALID",
		)
		expect(errorCode(() => parseManifest(withEntry({ ...entry, size: 1.5 })))).toBe(
			"MANIFEST_INVALID",
		)
	})

	it("only trusts HTTPS release downloads of the Cortex repository", () => {
		expect(isTrustedReleaseUrl(releaseUrl("Cortex.zip"))).toBe(true)
		expect(isTrustedReleaseUrl(releaseUrl("Cortex.zip").replace("https:", "http:"))).toBe(false)
		expect(
			isTrustedReleaseUrl("https://github.com/evil/cortex-app/releases/download/v1/a.zip"),
		).toBe(false)
		expect(
			isTrustedReleaseUrl(
				"https://github.com.evil.dev/cortex-md/cortex-app/releases/download/v1/a",
			),
		).toBe(false)
		expect(
			isTrustedReleaseUrl("https://user@github.com/cortex-md/cortex-app/releases/download/v1/a"),
		).toBe(false)
		expect(
			isTrustedReleaseUrl("https://github.com:8443/cortex-md/cortex-app/releases/download/v1/a"),
		).toBe(false)
		expect(isTrustedReleaseUrl("not a url")).toBe(false)
		const untrusted = manifestJson({
			platforms: {
				"darwin-arm64": {
					type: "zip",
					url: "https://example.com/Cortex.zip",
					sha256: "c".repeat(64),
					size: 3,
				},
			},
		})
		expect(errorCode(() => parseManifest(untrusted))).toBe("MANIFEST_INVALID")
	})

	it("selects the package for the running platform and architecture", () => {
		const manifest = parseManifest(manifestJson())
		expect(selectPlatformPackage(manifest, "win32", "x64").type).toBe("nsis")
		expect(selectPlatformPackage(manifest, "linux", "x64").type).toBe("appimage")
		expect(errorCode(() => selectPlatformPackage(manifest, "darwin", "x64"))).toBe(
			"NO_PLATFORM_BUILD",
		)
		expect(errorCode(() => selectPlatformPackage(manifest, "freebsd", "x64"))).toBe(
			"NO_PLATFORM_BUILD",
		)
		expect(toPlatformKey("linux", "ia32")).toBeNull()
	})
})
