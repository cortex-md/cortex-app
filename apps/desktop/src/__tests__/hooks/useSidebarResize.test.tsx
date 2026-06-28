import { useUIStore } from "@cortex/core"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useSidebarResize } from "../../hooks/useSidebarResize"

interface SidebarResizeHarnessProps {
	onResize: (width: number) => void
}

function SidebarResizeHarness({ onResize }: SidebarResizeHarnessProps) {
	const [width, setWidth] = useState(240)
	const updateWidth = (nextWidth: number) => {
		setWidth(nextWidth)
		useUIStore.getState().setLeftSidebarWidth(nextWidth)
		onResize(nextWidth)
	}
	const { sidebarElementRef, handleSidebarResizeStart } = useSidebarResize(
		false,
		width,
		updateWidth,
	)

	return (
		<div>
			<aside ref={sidebarElementRef} data-testid="sidebar" style={{ width }} />
			<div data-testid="resizer" onPointerDown={handleSidebarResizeStart} />
		</div>
	)
}

beforeEach(() => {
	useUIStore.setState({ leftSidebarCollapsed: false, leftSidebarWidth: 240 })
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("useSidebarResize", () => {
	it("tracks pointer movement across the document and persists the final width", () => {
		const onResize = vi.fn()
		render(<SidebarResizeHarness onResize={onResize} />)

		const sidebar = screen.getByTestId("sidebar")
		const resizer = screen.getByTestId("resizer")

		fireEvent.pointerDown(resizer, { button: 0, clientX: 100, pointerId: 8 })
		fireEvent.pointerMove(document, { clientX: 160, pointerId: 8 })
		fireEvent.pointerUp(document, { pointerId: 8 })

		expect(sidebar).toHaveStyle({ width: "300px" })
		expect(onResize).toHaveBeenCalledWith(300)
		expect(useUIStore.getState().leftSidebarWidth).toBe(300)
	})
})
