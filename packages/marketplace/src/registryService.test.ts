import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	fetchManifestMetadata,
	fetchManifestMinVersion,
	invalidateRegistryCache,
} from "./registryService"

const testState = vi.hoisted(() => ({
	platform: {
		http: {
			fetch: vi.fn(),
			download: vi.fn(),
		},
	},
}))

vi.mock("@cortex/platform", () => ({
	getPlatform: () => testState.platform,
}))

function createJsonResponse(body: unknown, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: vi.fn(async () => body),
		text: vi.fn(async () => JSON.stringify(body)),
	} as unknown as Response
}

function createInvalidJsonResponse(status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: vi.fn(async () => {
			throw new Error("Invalid JSON")
		}),
		text: vi.fn(async () => "{"),
	} as unknown as Response
}

function createRelease(repo: string, assets: { name: string; url: string }[]) {
	return {
		tag_name: "v0.1.0",
		published_at: "2026-03-22T23:20:33Z",
		zipball_url: `https://api.github.com/repos/${repo}/zipball/v0.1.0`,
		assets: assets.map((asset) => ({
			name: asset.name,
			browser_download_url: asset.url,
		})),
	}
}

beforeEach(() => {
	invalidateRegistryCache()
	testState.platform.http.fetch.mockReset()
	testState.platform.http.download.mockReset()
})

describe("fetchManifestMetadata", () => {
	it("reads version, minimum app version, and capabilities from latest release manifest assets", async () => {
		const repo = "furqas/jorge"
		testState.platform.http.fetch.mockResolvedValueOnce(
			createJsonResponse(
				createRelease(repo, [
					{
						name: "manifest.json",
						url: "https://github.com/furqas/jorge/releases/download/v0.1.0/manifest.json",
					},
				]),
			),
		)
		testState.platform.http.download.mockResolvedValueOnce(
			JSON.stringify({
				version: "0.3.0",
				minAppVersion: "0.2.0",
				capabilities: ["editor:read", "workspace:tabs", "editor:read", ""],
			}),
		)

		const metadata = await fetchManifestMetadata(repo)

		expect(metadata).toEqual({
			version: "0.3.0",
			minAppVersion: "0.2.0",
			capabilities: ["editor:read", "workspace:tabs"],
		})
		expect(testState.platform.http.download).toHaveBeenCalledWith(
			"https://github.com/furqas/jorge/releases/download/v0.1.0/manifest.json",
		)
		expect(testState.platform.http.fetch).toHaveBeenCalledTimes(1)
	})

	it("falls back to raw manifest lookup when the latest release has no manifest asset", async () => {
		const repo = "owner/source-plugin"
		testState.platform.http.fetch
			.mockResolvedValueOnce(createJsonResponse(createRelease(repo, [])))
			.mockResolvedValueOnce(
				createJsonResponse({
					version: "1.4.2",
					minAppVersion: "0.4.0",
					capabilities: ["commands"],
				}),
			)

		const metadata = await fetchManifestMetadata(repo)

		expect(metadata).toEqual({
			version: "1.4.2",
			minAppVersion: "0.4.0",
			capabilities: ["commands"],
		})
		expect(testState.platform.http.download).not.toHaveBeenCalled()
		expect(testState.platform.http.fetch).toHaveBeenNthCalledWith(
			2,
			"https://raw.githubusercontent.com/owner/source-plugin/main/manifest.json",
		)
	})

	it("returns empty metadata when no manifest can be found", async () => {
		const repo = "owner/no-manifest"
		testState.platform.http.fetch
			.mockResolvedValueOnce(createJsonResponse(createRelease(repo, [])))
			.mockResolvedValueOnce(createJsonResponse({}, 404))
			.mockResolvedValueOnce(createJsonResponse({}, 404))

		const metadata = await fetchManifestMetadata(repo)

		expect(metadata).toEqual({
			version: null,
			minAppVersion: null,
			capabilities: [],
		})
	})

	it("returns empty metadata when a manifest is invalid", async () => {
		const repo = "owner/broken-plugin"
		testState.platform.http.fetch.mockResolvedValueOnce(
			createJsonResponse(
				createRelease(repo, [
					{
						name: "manifest.json",
						url: "https://github.com/owner/broken-plugin/releases/download/v0.1.0/manifest.json",
					},
				]),
			),
		)
		testState.platform.http.download.mockResolvedValueOnce("{")

		const metadata = await fetchManifestMetadata(repo)

		expect(metadata).toEqual({
			version: null,
			minAppVersion: null,
			capabilities: [],
		})
		expect(testState.platform.http.fetch).toHaveBeenCalledTimes(1)
	})

	it("returns empty metadata when raw manifest JSON cannot be parsed", async () => {
		const repo = "owner/raw-broken-plugin"
		testState.platform.http.fetch
			.mockResolvedValueOnce(createJsonResponse(createRelease(repo, [])))
			.mockResolvedValueOnce(createInvalidJsonResponse())

		const metadata = await fetchManifestMetadata(repo)

		expect(metadata).toEqual({
			version: null,
			minAppVersion: null,
			capabilities: [],
		})
	})
})

describe("fetchManifestMinVersion", () => {
	it("reads manifest.json from the latest release asset before trying raw GitHub files", async () => {
		const repo = "furqas/jorge"
		testState.platform.http.fetch.mockResolvedValueOnce(
			createJsonResponse(
				createRelease(repo, [
					{
						name: "manifest.json",
						url: "https://github.com/furqas/jorge/releases/download/v0.1.0/manifest.json",
					},
				]),
			),
		)
		testState.platform.http.download.mockResolvedValueOnce(
			JSON.stringify({ minAppVersion: "0.1.0" }),
		)

		const minVersion = await fetchManifestMinVersion(repo)

		expect(minVersion).toBe("0.1.0")
		expect(testState.platform.http.download).toHaveBeenCalledWith(
			"https://github.com/furqas/jorge/releases/download/v0.1.0/manifest.json",
		)
		expect(testState.platform.http.fetch).toHaveBeenCalledTimes(1)
		expect(testState.platform.http.fetch.mock.calls[0][0]).toBe(
			"https://api.github.com/repos/furqas/jorge/releases/latest",
		)
	})

	it("falls back to raw manifest lookup when the release has no manifest asset", async () => {
		const repo = "owner/source-plugin"
		testState.platform.http.fetch
			.mockResolvedValueOnce(createJsonResponse(createRelease(repo, [])))
			.mockResolvedValueOnce(createJsonResponse({ minAppVersion: "0.2.0" }))

		const minVersion = await fetchManifestMinVersion(repo)

		expect(minVersion).toBe("0.2.0")
		expect(testState.platform.http.download).not.toHaveBeenCalled()
		expect(testState.platform.http.fetch).toHaveBeenNthCalledWith(
			2,
			"https://raw.githubusercontent.com/owner/source-plugin/main/manifest.json",
		)
	})

	it("does not try raw manifest lookup when the release manifest asset is present but unreadable", async () => {
		const repo = "owner/broken-asset-plugin"
		testState.platform.http.fetch.mockResolvedValueOnce(
			createJsonResponse(
				createRelease(repo, [
					{
						name: "manifest.json",
						url: "https://github.com/owner/broken-asset-plugin/releases/download/v0.1.0/manifest.json",
					},
				]),
			),
		)
		testState.platform.http.download.mockRejectedValueOnce(new Error("Download failed: 404"))

		const minVersion = await fetchManifestMinVersion(repo)

		expect(minVersion).toBeNull()
		expect(testState.platform.http.fetch).toHaveBeenCalledTimes(1)
	})
})
