import { describe, expect, it } from "vitest"
import { compareSemVer, isNewerVersion, isPrerelease, parseSemVer } from "../../updates/version"

function compare(left: string, right: string): number {
	const a = parseSemVer(left)
	const b = parseSemVer(right)
	if (!a || !b) throw new Error("invalid fixture")
	return compareSemVer(a, b)
}

describe("semver comparison", () => {
	it("orders major, minor and patch numerically", () => {
		expect(compare("1.10.0", "1.9.9")).toBe(1)
		expect(compare("2.0.0", "10.0.0")).toBe(-1)
		expect(compare("1.4.0", "v1.4.0")).toBe(0)
	})

	it("ranks prereleases below the release and by identifier", () => {
		expect(compare("1.4.0-beta.1", "1.4.0")).toBe(-1)
		expect(compare("1.4.0-beta.2", "1.4.0-beta.10")).toBe(-1)
		expect(compare("1.4.0-alpha", "1.4.0-beta")).toBe(-1)
		expect(compare("1.4.0-beta", "1.4.0-beta.1")).toBe(-1)
		expect(compare("1.4.0-1", "1.4.0-beta")).toBe(-1)
	})

	it("ignores build metadata", () => {
		expect(compare("1.4.0+build.5", "1.4.0+build.9")).toBe(0)
	})

	it("refuses downgrades, same versions and invalid input", () => {
		expect(isNewerVersion("1.4.0", "1.3.9")).toBe(true)
		expect(isNewerVersion("1.4.0", "1.4.0")).toBe(false)
		expect(isNewerVersion("1.3.0", "1.4.0")).toBe(false)
		expect(isNewerVersion("1.4.0-beta.1", "1.4.0")).toBe(false)
		expect(isNewerVersion("not-a-version", "1.0.0")).toBe(false)
		expect(isNewerVersion("1.0", "0.9.0")).toBe(false)
	})

	it("detects prereleases", () => {
		expect(isPrerelease("0.2.0-beta.1")).toBe(true)
		expect(isPrerelease("0.2.0")).toBe(false)
	})
})
