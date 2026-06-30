import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MermaidDiagramExplorer } from "../../../features/mermaid/MermaidDiagramExplorer"

const mermaidDiagramState = vi.hoisted(() => ({
	getSvg: (source: string) =>
		source === "overflow"
			? '<svg role="img" viewBox="0 0 100 50"><text>Overflow</text></svg>'
			: source === "second"
				? '<svg role="img" viewBox="0 0 200 100"><text>Second</text></svg>'
				: '<svg role="img" viewBox="0 0 100 50"><text>First</text></svg>',
}))

vi.mock("../../../features/mermaid/useMermaidDiagram", () => ({
	useMermaidDiagram: (source: string) => ({
		status: "success",
		svg: mermaidDiagramState.getSvg(source),
	}),
}))

let originalGetBBoxDescriptor: PropertyDescriptor | undefined
let viewportRect: Partial<DOMRect>

function createRect(rect: Partial<DOMRect>): DOMRect {
	return {
		x: rect.left ?? 0,
		y: rect.top ?? 0,
		left: rect.left ?? 0,
		top: rect.top ?? 0,
		right: rect.right ?? (rect.left ?? 0) + (rect.width ?? 0),
		bottom: rect.bottom ?? (rect.top ?? 0) + (rect.height ?? 0),
		width: rect.width ?? 0,
		height: rect.height ?? 0,
		toJSON: () => ({}),
	} as DOMRect
}

function getSvg(container: HTMLElement): SVGSVGElement {
	const svg = container.querySelector(".mermaid-explorer-content svg")
	if (!(svg instanceof SVGSVGElement)) throw new Error("SVG not rendered")
	return svg
}

function getViewport(container: HTMLElement): HTMLElement {
	const viewport = container.querySelector<HTMLElement>(".mermaid-explorer-viewport")
	if (!viewport) throw new Error("Viewport not rendered")
	return viewport
}

beforeEach(() => {
	originalGetBBoxDescriptor = Object.getOwnPropertyDescriptor(SVGSVGElement.prototype, "getBBox")
	viewportRect = { left: 10, top: 20, width: 400, height: 200 }
	vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
		callback(0)
		return 1
	})
	vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
	vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
		if (this instanceof HTMLElement && this.classList.contains("mermaid-explorer-viewport")) {
			return createRect(viewportRect)
		}
		return createRect({ width: 100, height: 50 })
	})
	Object.defineProperty(SVGSVGElement.prototype, "getBBox", {
		configurable: true,
		value: vi.fn(function (this: SVGSVGElement) {
			if (this.textContent?.includes("Overflow")) {
				return createRect({ left: -25, top: 0, width: 150, height: 50 })
			}
			if (this.textContent?.includes("Second")) {
				return createRect({ left: 0, top: 0, width: 200, height: 100 })
			}
			return createRect({ left: 0, top: 0, width: 100, height: 50 })
		}),
	})
})

afterEach(() => {
	vi.restoreAllMocks()
	if (originalGetBBoxDescriptor) {
		Object.defineProperty(SVGSVGElement.prototype, "getBBox", originalGetBBoxDescriptor)
	} else {
		Reflect.deleteProperty(SVGSVGElement.prototype, "getBBox")
	}
})

describe("MermaidDiagramExplorer", () => {
	it("applies an initial fit viewBox without a CSS transform", () => {
		const { container } = render(<MermaidDiagramExplorer source="first" title="Diagram" />)

		expect(getSvg(container).getAttribute("viewBox")).toBe("-8 -4 116 58")
		expect(container.querySelector(".mermaid-explorer-content")?.getAttribute("style")).toBeNull()
	})

	it("zooms with the wheel around the pointer", () => {
		const { container } = render(<MermaidDiagramExplorer source="first" title="Diagram" />)
		const viewport = getViewport(container)

		fireEvent.wheel(viewport, { deltaY: -100, clientX: 210, clientY: 120 })

		expect(getSvg(container).getAttribute("viewBox")).toBe("0.8475 0.4237 98.3051 49.1525")
	})

	it("pans by mutating the viewBox", () => {
		const { container } = render(<MermaidDiagramExplorer source="first" title="Diagram" />)
		const viewport = getViewport(container)

		fireEvent.pointerDown(viewport, { button: 0, pointerId: 1, clientX: 210, clientY: 120 })
		fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 250, clientY: 140 })
		fireEvent.pointerUp(viewport, { pointerId: 1, clientX: 250, clientY: 140 })

		expect(getSvg(container).getAttribute("viewBox")).toBe("-19.6 -9.8 116 58")
		expect(viewport).not.toHaveAttribute("data-dragging")
	})

	it("restores the fit camera with fit and reset", () => {
		const { container } = render(<MermaidDiagramExplorer source="first" title="Diagram" />)
		const viewport = getViewport(container)

		fireEvent.wheel(viewport, { deltaY: -100, clientX: 210, clientY: 120 })
		fireEvent.click(screen.getByRole("button", { name: "Fit diagram" }))
		expect(getSvg(container).getAttribute("viewBox")).toBe("-8 -4 116 58")

		fireEvent.wheel(viewport, { deltaY: -100, clientX: 210, clientY: 120 })
		fireEvent.click(screen.getByRole("button", { name: "Reset view" }))

		expect(getSvg(container).getAttribute("viewBox")).toBe("-8 -4 116 58")
	})

	it("reinitializes the camera when the source changes", () => {
		const { container, rerender } = render(
			<MermaidDiagramExplorer source="first" title="Diagram" />,
		)

		rerender(<MermaidDiagramExplorer source="second" title="Diagram" />)

		expect(getSvg(container).getAttribute("viewBox")).toBe("-16 -8 232 116")
	})

	it("fits the rendered content bounds when they exceed the original viewBox", () => {
		const { container } = render(<MermaidDiagramExplorer source="overflow" title="Diagram" />)

		expect(getSvg(container).getAttribute("viewBox")).toBe("-37 -18.5 174 87")
	})

	it("pauses camera work while inactive and restores it when the tab becomes active again", () => {
		const { container, rerender } = render(
			<MermaidDiagramExplorer source="first" title="Diagram" isActive />,
		)
		const viewport = getViewport(container)

		expect(getSvg(container).getAttribute("viewBox")).toBe("-8 -4 116 58")
		fireEvent.wheel(viewport, { deltaY: -100, clientX: 210, clientY: 120 })
		const zoomedViewBox = getSvg(container).getAttribute("viewBox")
		expect(zoomedViewBox).toBe("0.8475 0.4237 98.3051 49.1525")

		viewportRect = { left: 10, top: 20, width: 0, height: 0 }
		rerender(<MermaidDiagramExplorer source="first" title="Diagram" isActive={false} />)
		fireEvent.wheel(viewport, { deltaY: -100, clientX: 210, clientY: 120 })

		expect(getSvg(container).getAttribute("viewBox")).toBe("0 0 100 50")

		viewportRect = { left: 10, top: 20, width: 400, height: 200 }
		rerender(<MermaidDiagramExplorer source="first" title="Diagram" isActive />)
		expect(getSvg(container).getAttribute("viewBox")).toBe(zoomedViewBox)

		fireEvent.wheel(viewport, { deltaY: -100, clientX: 210, clientY: 120 })

		expect(getSvg(container).getAttribute("viewBox")).not.toBe(zoomedViewBox)
	})
})
