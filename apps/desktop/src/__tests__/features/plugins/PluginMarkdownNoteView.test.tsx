import { ReadingView } from "@cortex/editor/reading-view"
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PluginMarkdownNoteView } from "../../../features/plugins/PluginMarkdownNoteView"

vi.mock("@cortex/editor/reading-view", () => ({
	ReadingView: vi.fn(() => null),
}))

describe("PluginMarkdownNoteView", () => {
	it("renders ephemeral plugin Markdown through the reading surface", () => {
		render(
			<PluginMarkdownNoteView
				viewState={{ content: "# Welcome\n\nPlugin intro." }}
				onStateChange={vi.fn()}
			/>,
		)

		expect(vi.mocked(ReadingView).mock.calls[0][0]).toMatchObject({
			content: "# Welcome\n\nPlugin intro.",
			scrollMode: "parent",
		})
	})
})
