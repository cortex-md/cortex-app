import { describe, expect, it } from "vitest"
import { pluginCode } from "../content/landing"
import { highlightCode, highlightDocsCode } from "./highlight"

describe("highlightCode", () => {
	it("generates Shiki HTML for the plugin snippet", async () => {
		const html = await highlightCode(pluginCode, "tsx")

		expect(html).toContain("cortex-shiki")
		expect(html).toContain("background-color: transparent")
		expect(html).toContain("CortexPlugin")
		expect(html).toContain("GitHubEmojiPlugin")
		expect(html).toContain("registerMarkdownInline")
		expect(html).toContain("insert-emoji")
		expect(html).not.toContain('</span>\n<span class="line"')
		expect(html).not.toContain("definePlugin")
	})

	it("preserves intentional empty code lines without inter-line text noise", async () => {
		const html = await highlightCode("const first = 1\n\nconst second = 2", "ts")

		expect(html).toContain('<span class="line"></span>')
		expect(html).not.toContain('</span>\n<span class="line"')
	})

	it("generates docs code blocks without inter-line text noise", async () => {
		const html = await highlightDocsCode("const first = 1\n\nconst second = 2", "ts")

		expect(html).toContain("cortex-docs-shiki")
		expect(html).toContain('<span class="line"></span>')
		expect(html).not.toContain('</span>\n<span class="line"')
	})
})
