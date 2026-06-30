import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { parseFencedCodeBlocks } from "../codeBlockEmbeds"
import { ReadingView } from "../ReadingView"

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("code block embeds", () => {
	it("parses matching fenced code blocks with source offsets", () => {
		const markdown = [
			"intro",
			"```ts",
			"const value = 1",
			"```",
			"~~~cortex-draw title",
			'{"id":"one"}',
			"~~~",
			"```cortex-draw",
			'{"id":"two"}',
		].join("\n")

		const blocks = parseFencedCodeBlocks(markdown, ["cortex-draw"])

		expect(blocks).toHaveLength(2)
		expect(blocks[0]).toMatchObject({
			language: "cortex-draw",
			info: "cortex-draw title",
			content: '{"id":"one"}\n',
			closingFenceFrom: markdown.indexOf("~~~", markdown.indexOf('{"id":"one"}')),
		})
		expect(blocks[1]).toMatchObject({
			language: "cortex-draw",
			content: '{"id":"two"}',
			closingFenceFrom: null,
			sourceTo: markdown.length,
		})
	})

	it("renders matching code blocks as React embeds and keeps task offsets source-relative", async () => {
		const onTaskCheckboxToggle = vi.fn()
		const content = [
			"- [ ] before",
			"```cortex-draw",
			'{"schema":"demo"}',
			"```",
			"- [ ] after",
		].join("\n")

		render(
			<ReadingView
				content={content}
				codeBlockEmbeds={[
					{
						languages: ["cortex-draw"],
						render: ({ content: blockContent, sourceFrom }) => (
							<button type="button" data-testid="drawing-card">
								{sourceFrom}:{blockContent.trim()}
							</button>
						),
					},
				]}
				onTaskCheckboxToggle={onTaskCheckboxToggle}
			/>,
		)

		await screen.findByTestId("drawing-card")

		expect(screen.getByTestId("drawing-card").textContent).toBe(
			`${content.indexOf("```cortex-draw")}:{"schema":"demo"}`,
		)
		expect(document.querySelector("pre code")).toBeNull()

		const checkboxes = Array.from(document.querySelectorAll<HTMLElement>("[data-task-checkbox]"))
		expect(checkboxes).toHaveLength(2)
		fireEvent.click(checkboxes[1])

		await waitFor(() => {
			expect(onTaskCheckboxToggle).toHaveBeenCalledWith(content.indexOf("- [ ] after"), true)
		})
	})
})
