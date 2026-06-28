import { describe, expect, it, vi } from "vitest"
import {
	fetchChangelogReleases,
	type GithubRelease,
	mapGithubRelease,
	normalizeReleaseVersion,
	renderReleaseMarkdown,
	stripDuplicateReleaseTitle,
} from "./changelog"

const stableRelease = {
	tag_name: "v0.1.0",
	name: "Cortex 0.1.0",
	body: '# Cortex v0.1.0\n\n## Added\n\n- Local Markdown vaults\n\n```ts\nconst version = "0.1.0"\n```',
	html_url: "https://github.com/cortex-md/cortex-app/releases/tag/v0.1.0",
	published_at: "2026-06-18T00:00:00Z",
	draft: false,
	prerelease: false,
} satisfies GithubRelease

function jsonResponse(body: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
		...init,
	})
}

describe("changelog releases", () => {
	it("normalizes release versions and strips duplicate leading release titles", () => {
		expect(normalizeReleaseVersion("v0.1.0")).toBe("0.1.0")
		expect(normalizeReleaseVersion("0.1.0")).toBe("0.1.0")
		expect(stripDuplicateReleaseTitle("# Cortex v0.1.0\n\nBody", "Cortex 0.1.0", "v0.1.0")).toBe(
			"Body",
		)
		expect(
			stripDuplicateReleaseTitle("# A specific feature\n\nBody", "Cortex 0.1.0", "v0.1.0"),
		).toBe("# A specific feature\n\nBody")
	})

	it("maps stable GitHub releases into changelog releases", async () => {
		const release = await mapGithubRelease(stableRelease)

		expect(release).toMatchObject({
			tagName: "v0.1.0",
			version: "0.1.0",
			title: "Cortex 0.1.0",
			formattedDate: "Jun 18, 2026",
		})
		expect(release?.bodyMarkdown).not.toContain("# Cortex v0.1.0")
		expect(release?.bodyHtml).toContain("cortex-docs-shiki")
	})

	it("filters drafts and prereleases when fetching GitHub releases", async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(
				jsonResponse([
					stableRelease,
					{ ...stableRelease, tag_name: "v0.2.0-beta.1", prerelease: true },
					{ ...stableRelease, tag_name: "v0.0.9", draft: true },
				]),
			)

		const result = await fetchChangelogReleases(fetcher)

		expect(result.status).toBe("ok")
		expect(result.releases.map((release) => release.tagName)).toEqual(["v0.1.0"])
		expect(fetcher).toHaveBeenCalledWith(
			"https://api.github.com/repos/cortex-md/cortex-app/releases?per_page=20",
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: "application/vnd.github+json",
					"X-GitHub-Api-Version": "2022-11-28",
					"User-Agent": "Cortex website changelog",
				}),
			}),
		)
	})

	it("handles 404s and network errors without throwing", async () => {
		const notFound = await fetchChangelogReleases(
			vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 })),
		)
		const networkError = await fetchChangelogReleases(
			vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")),
		)

		expect(notFound).toMatchObject({
			status: "empty",
			releases: [],
			message: "No public stable release notes are available yet.",
		})
		expect(networkError).toMatchObject({
			status: "unavailable",
			releases: [],
			message: "Release notes are temporarily unavailable.",
		})
	})

	it("renders release markdown without evaluating raw HTML or unsafe URLs", async () => {
		const html = await renderReleaseMarkdown(
			[
				"## Safe notes",
				"",
				"<script>alert('bad')</script>",
				"",
				"[unsafe](javascript:alert('bad'))",
				"",
				"![unsafe image](javascript:alert('bad'))",
				"",
				"[safe](https://example.com/release)",
			].join("\n"),
		)

		expect(html).toContain('<h2 id="safe-notes">Safe notes</h2>')
		expect(html).not.toContain("<script")
		expect(html).not.toContain("javascript:")
		expect(html).toContain("<a>unsafe</a>")
		expect(html).toContain(
			'<a href="https://example.com/release" target="_blank" rel="noreferrer">safe</a>',
		)
	})
})
