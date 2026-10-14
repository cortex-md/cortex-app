import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { ChangelogResult } from "../../server/changelog"
import { ChangelogPage } from "./ChangelogPage"

const releaseResult = {
	status: "ok",
	message: "Stable public release notes loaded.",
	releases: [
		{
			tagName: "v0.1.0",
			version: "0.1.0",
			title: "Local Markdown workspace",
			url: "https://github.com/cortex-md/cortex-app/releases/tag/v0.1.0",
			publishedAt: "2026-06-18T00:00:00Z",
			formattedDate: "Jun 18, 2026",
			bodyMarkdown: "## Added\n\nPlain files stay local.",
			bodyHtml: "<h2>Added</h2><p>Plain files stay local.</p>",
		},
	],
} satisfies ChangelogResult

describe("ChangelogPage", () => {
	it("renders a single timeline with release metadata and markdown content", () => {
		const { container } = render(<ChangelogPage changelog={releaseResult} />)

		expect(screen.getByRole("heading", { level: 1, name: "Changelog" })).toBeTruthy()
		expect(screen.getByRole("link", { name: "RSS" }).getAttribute("href")).toBe("/changelog.xml")
		expect(
			screen.getByRole("heading", {
				level: 2,
				name: "Local Markdown workspace",
			}),
		).toBeTruthy()
		expect(screen.getByRole("link", { name: "v0.1.0" })).toBeTruthy()
		expect(screen.getByText("Latest")).toBeTruthy()
		expect(screen.getByText("Jun 18, 2026")).toBeTruthy()
		expect(screen.getByText("Plain files stay local.")).toBeTruthy()
		expect(container.querySelector(".markdown-surface.docs-markdown")).toBeTruthy()
		expect(screen.getByRole("link", { name: /View v0.1.0 on GitHub/i }).getAttribute("href")).toBe(
			"https://github.com/cortex-md/cortex-app/releases/tag/v0.1.0",
		)
	})

	it("renders an honest empty state when no public stable releases exist", () => {
		render(
			<ChangelogPage
				changelog={{
					status: "empty",
					message: "No public stable release notes are available yet.",
					releases: [],
				}}
			/>,
		)

		expect(
			screen.getByRole("heading", {
				level: 2,
				name: /No public stable release notes yet/i,
			}),
		).toBeTruthy()
		expect(
			screen.getAllByText("No public stable release notes are available yet.").length,
		).toBeGreaterThan(0)
		expect(screen.queryByRole("link", { name: /on GitHub/i })).toBeNull()
		expect(screen.getByRole("link", { name: "Read the docs" }).getAttribute("href")).toBe("/docs")
	})
})
