import { describe, expect, it } from "vitest"
import { highlightCode, highlightDocsCode } from "./highlight"

const pluginCode = `import { definePlugin } from "@cortex.md/api"
import { GITHUB_EMOJI_MAP } from "./emojiMap"

export default definePlugin({
  manifest: { id: "github-emoji", name: "GitHub Emoji", permissions: ["editor:write"] },
  contributes: {
    commands: [{
      id: "insert-emoji",
      label: "Insert Emoji",
      run: (ctx) => ctx.editor.insertAtCursor(GITHUB_EMOJI_MAP.sparkles),
    }],
  },
})`

describe("highlightCode", () => {
	it("generates Shiki HTML for the plugin snippet", async () => {
		const html = await highlightCode(pluginCode, "tsx")

		expect(html).toContain("cortex-shiki")
		expect(html).toContain("background-color: transparent")
		expect(html).toContain("definePlugin")
		expect(html).toContain("@cortex.md/api")
		expect(html).toContain("github-emoji")
		expect(html).toContain("insert-emoji")
		expect(html).not.toContain('</span>\n<span class="line"')
		expect(html).not.toContain("CortexPlugin")
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
