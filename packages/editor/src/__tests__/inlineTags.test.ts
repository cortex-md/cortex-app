import { markdown } from "@codemirror/lang-markdown"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { extractMarkdownInlineTags, findInlineTags } from "@cortex/properties/tags"
import { createRenderer } from "@cortex/renderer/pipeline"
import { GFM } from "@lezer/markdown"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { livePreviewExtension } from "../livePreview"
import { loadEditorRuntime } from "../runtime"

const editorViews: EditorView[] = []
let editorRuntime: Awaited<ReturnType<typeof loadEditorRuntime>>

beforeAll(async () => {
	editorRuntime = await loadEditorRuntime()
})

afterEach(() => {
	for (const view of editorViews.splice(0)) view.destroy()
	document.body.replaceChildren()
})

function livePreviewTags(content: string): string[] {
	const parent = document.createElement("div")
	document.body.appendChild(parent)
	const view = new EditorView({
		state: EditorState.create({
			doc: `${content}\n\ntail`,
			selection: { anchor: content.length + 6 },
			extensions: [markdown({ extensions: GFM }), livePreviewExtension(editorRuntime)],
		}),
		parent,
	})
	editorViews.push(view)
	return Array.from(document.querySelectorAll<HTMLElement>(".cm-tag[data-tag]")).map((tag) =>
		(tag.dataset.tag ?? "").toLowerCase(),
	)
}

async function readingViewTags(content: string): Promise<string[]> {
	const html = await createRenderer().render(content)
	return Array.from(html.matchAll(/data-tag="([^"]+)"/g), (match) => match[1].toLowerCase())
}

const PARITY_NOTE = [
	"Plan #release and #Plugins/review today.",
	"Not a heading: #heading-like, but # Heading is not a tag.",
	"Skip `#inline-code` and [anchor](#section) and https://example.com/#frag.",
	"Wiki [[Note#Heading]] and email a#b stay plain; (#paren) counts.",
	"```",
	"#fenced",
	"```",
	"Unicode #café and numbers #2026 are different.",
].join("\n")

describe("inline tag rule", () => {
	it("matches tags only at word boundaries", () => {
		expect(findInlineTags("a #one b#two (#three) *#four* #5x").map((range) => range.tag)).toEqual([
			"one",
			"three",
			"four",
		])
		expect(findInlineTags("#nested/path/ end").map((range) => range.tag)).toEqual(["nested/path"])
		expect(findInlineTags("[x](#anchor) /#frag")).toEqual([])
	})

	it("excludes code spans and fenced code when indexing", () => {
		expect(extractMarkdownInlineTags(PARITY_NOTE)).toEqual([
			"release",
			"plugins/review",
			"heading-like",
			"paren",
			"café",
		])
	})

	it("decorates the same tags in Live Preview and Reading View as the indexer", async () => {
		const indexed = extractMarkdownInlineTags(PARITY_NOTE)
		expect([...new Set(livePreviewTags(PARITY_NOTE))]).toEqual(indexed)
		expect([...new Set(await readingViewTags(PARITY_NOTE))]).toEqual(indexed)
	})
})
