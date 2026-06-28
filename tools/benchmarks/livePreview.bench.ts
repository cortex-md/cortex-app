import { markdown } from "@codemirror/lang-markdown"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { beforeAll, bench } from "vitest"
import { livePreviewExtension } from "../../packages/editor/src/livePreview"
import { loadEditorRuntime } from "../../packages/editor/src/runtime"

let editorRuntime: Awaited<ReturnType<typeof loadEditorRuntime>>

beforeAll(async () => {
	editorRuntime = await loadEditorRuntime()
})

function createMarkdownDocument(lineCount: number): string {
	return Array.from({ length: lineCount }, (_, index) => {
		if (index % 40 === 0) return `> [!note]+ Section ${index}\n> **Content** for section ${index}`
		if (index % 25 === 0) return `\`\`\`ts\nconst value${index} = ${index}\n\`\`\``
		if (index % 15 === 0) return `| Key | Value |\n| --- | --- |\n| ${index} | *value* |`
		return `Line ${index} with **bold**, [link](https://example.com), and :emoji:`
	}).join("\n")
}

for (const lineCount of [5_000, 20_000]) {
	const content = createMarkdownDocument(lineCount)
	bench(
		`Live Preview ${lineCount} lines`,
		() => {
			const parent = document.createElement("div")
			document.body.appendChild(parent)
			const view = new EditorView({
				state: EditorState.create({
					doc: content,
					extensions: [markdown(), livePreviewExtension(editorRuntime)],
				}),
				parent,
			})
			view.dispatch({ changes: { from: content.length, insert: "\nnext" } })
			view.destroy()
			parent.remove()
		},
		{ iterations: 5 },
	)
}
