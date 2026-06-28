import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
	type SplitPaneLeafProps,
	SplitPaneView,
	type SplitTree,
} from "../../../features/layout/SplitPane"

const splitTree: SplitTree = {
	type: "split",
	id: "root",
	direction: "horizontal",
	sizes: [50, 50],
	children: [
		{ type: "leaf", id: "left" },
		{ type: "leaf", id: "right" },
	],
}

function TestLeaf({ paneId }: SplitPaneLeafProps) {
	const [count, setCount] = useState(0)

	return (
		<button type="button" onClick={() => setCount((value) => value + 1)}>
			{paneId}:{count}
		</button>
	)
}

afterEach(cleanup)

describe("SplitPaneView", () => {
	it("renders split leaves through a stable component boundary", async () => {
		const onResize = vi.fn()
		const { rerender } = render(
			<SplitPaneView node={splitTree} LeafComponent={TestLeaf} onResize={onResize} />,
		)

		await userEvent.click(screen.getByRole("button", { name: "left:0" }))

		rerender(<SplitPaneView node={splitTree} LeafComponent={TestLeaf} onResize={onResize} />)

		expect(screen.getByRole("button", { name: "left:1" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "right:0" })).toBeInTheDocument()
	})

	it("marks only the leading leaf as the window start pane", () => {
		const onResize = vi.fn()
		const { container } = render(
			<SplitPaneView node={splitTree} LeafComponent={TestLeaf} onResize={onResize} />,
		)

		const leaves = container.querySelectorAll(".split-leaf")

		expect(leaves).toHaveLength(2)
		expect(leaves[0]).toHaveAttribute("data-split-start-pane", "true")
		expect(leaves[1]).not.toHaveAttribute("data-split-start-pane")
	})
})
