// @ts-expect-error Tests read source fixtures through Node's built-in fs module.
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const markdownCssImport = 'import "./markdown.css"'

function readEditorSource(fileName: string): string {
	return readFileSync(`src/${fileName}`, "utf8")
}

describe("markdown surface styles", () => {
	it.each([
		"EditorView.tsx",
		"ReadingView.tsx",
	])("loads shared markdown styles from %s", (fileName) => {
		expect(readEditorSource(fileName)).toContain(markdownCssImport)
	})

	it("keeps heading typography aligned with the compact theme scale", () => {
		const markdownCss = readEditorSource("markdown.css")
		const highlightSource = readEditorSource("highlight.ts")

		expect(markdownCss).toContain("font-weight: var(--heading-font-weight, 600)")
		expect(markdownCss).toContain("font-size: var(--h6-font-size, 0.85em)")
		expect(markdownCss).toContain(
			"padding: var(--markdown-code-padding-block, 8px) var(--markdown-code-padding-inline, 16px)",
		)
		expect(highlightSource).toContain('fontWeight: "var(--heading-font-weight, 600)"')
	})

	it("keeps block code font and padding themeable without changing inline code", () => {
		const markdownCss = readEditorSource("markdown.css")
		const livePreviewCss = readEditorSource("livePreview/styles.css")

		expect(markdownCss).toContain(".markdown-surface pre code")
		expect(markdownCss).toContain("--markdown-code-font-family")
		expect(markdownCss).toContain("font-size: var(--markdown-code-font-size, 14px)")
		expect(markdownCss).toContain(".markdown-surface .cm-inline-code")
		expect(markdownCss).toContain("font-family: var(--font-editor)")
		expect(markdownCss).toContain(".markdown-surface pre code * {\n\tfont-family: inherit")
		expect(livePreviewCss).toContain("padding-inline: var(--markdown-code-padding-inline, 16px)")
		expect(livePreviewCss).toContain("--markdown-code-font-family")
		expect(livePreviewCss).toContain("font-size: var(--markdown-code-font-size, 14px)")
		expect(livePreviewCss).toContain(".cm-line.cm-codeblock-line * {\n\tfont-family: inherit")
	})
})
