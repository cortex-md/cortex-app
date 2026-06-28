import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../EditorView", () => ({
	EditorView: vi.fn(() => null),
}))

vi.mock("../ReadingView", () => ({
	ReadingView: vi.fn(() => null),
}))

import { EditorView } from "../EditorView"
import { ReadingView } from "../ReadingView"
import { SideBySideView } from "../SideBySideView"

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("SideBySideView", () => {
	it("pairs Live Preview editing with Reading View rendering", () => {
		const onChange = vi.fn()
		const resolveImageUrl = vi.fn((src: string) => `cortex://asset/${src}`)

		render(
			<SideBySideView
				content="# Plan"
				filePath="/vault/Projects/Plan.md"
				resolveImageUrl={resolveImageUrl}
				onChange={onChange}
			/>,
		)

		expect(EditorView).toHaveBeenCalledTimes(1)
		expect(ReadingView).toHaveBeenCalledTimes(1)
		expect(vi.mocked(EditorView).mock.calls[0][0]).toMatchObject({
			content: "# Plan",
			filePath: "/vault/Projects/Plan.md",
			livePreview: true,
			resolveImageUrl,
			onChange,
		})
		expect(vi.mocked(ReadingView).mock.calls[0][0]).toMatchObject({
			content: "# Plan",
			renderDelay: 80,
		})
	})
})
