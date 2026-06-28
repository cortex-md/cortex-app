import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DocsShell } from "./components/DocsShell"
import { docsNavigation, getDocBySlug } from "./registry"

let intersectionCallback: IntersectionObserverCallback | undefined

class MockIntersectionObserver implements IntersectionObserver {
	readonly root = null
	readonly rootMargin = ""
	readonly scrollMargin = ""
	readonly thresholds = []

	constructor(callback: IntersectionObserverCallback) {
		intersectionCallback = callback
	}

	disconnect = vi.fn()
	observe = vi.fn()
	takeRecords = vi.fn(() => [])
	unobserve = vi.fn()
}

function getRequiredDoc(slug: string) {
	const page = getDocBySlug(slug)
	if (!page) throw new Error(`Missing docs fixture: ${slug}`)
	return page
}

describe("DocsShell", () => {
	beforeEach(() => {
		intersectionCallback = undefined
		vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: {
				writeText: vi.fn().mockResolvedValue(undefined),
			},
		})
	})

	it("renders navigation, markdown content, cards, toc, and a centered command search", () => {
		const page = getRequiredDoc("plugins/overview")

		const { container } = render(<DocsShell page={page} navigation={docsNavigation} />)

		expect(screen.getByRole("heading", { level: 1, name: "Community Plugins" })).toBeTruthy()
		expect(screen.queryByRole("navigation", { name: "Site navigation" })).toBeNull()
		expect(screen.queryByRole("button", { name: /Resources/i })).toBeNull()
		expect(screen.getByRole("button", { name: /Switch to/i })).toBeTruthy()
		expect(screen.getByRole("link", { name: "Cortex home" }).getAttribute("href")).toBe("/")
		expect(screen.getByRole("navigation", { name: "Docs navigation" })).toBeTruthy()
		expect(screen.getAllByRole("navigation", { name: "On this page" }).length).toBeGreaterThan(0)
		expect(
			screen
				.getAllByRole("link", { name: /Cortex CLI/i })
				.at(-1)
				?.getAttribute("href"),
		).toBe("/docs/developers/cli")
		expect(screen.getByRole("button", { name: "Search docs" })).toBeTruthy()
		expect(screen.queryByPlaceholderText("Search docs...")).toBeNull()
		expect(container.querySelector(".markdown-surface")).toBeTruthy()
		expect(container.querySelector(".cortex-docs-shiki")).toBeTruthy()
		expect(container.querySelector("[data-code-meta]")).toBeTruthy()
	})

	it("opens command search with mod+k and includes pages and headings", async () => {
		const page = getRequiredDoc("plugins/overview")
		render(<DocsShell page={page} navigation={docsNavigation} />)

		fireEvent.keyDown(window, { key: "k", metaKey: true })

		expect(await screen.findByPlaceholderText("Search docs...")).toBeTruthy()
		expect(screen.getAllByText("Sync Overview").length).toBeGreaterThan(0)
		expect(screen.getAllByText("Extension surfaces").length).toBeGreaterThan(0)
	})

	it("marks the active toc heading as the observer changes sections", () => {
		const page = getRequiredDoc("plugins/overview")
		const nextHeading = page.headings[1]
		if (!nextHeading) throw new Error("Missing docs heading fixture")
		render(<DocsShell page={page} navigation={docsNavigation} />)

		const target = document.getElementById(nextHeading.id)
		if (!target) throw new Error(`Missing rendered heading target: ${nextHeading.id}`)

		act(() => {
			intersectionCallback?.(
				[
					{
						boundingClientRect: { top: 72 } as DOMRectReadOnly,
						intersectionRatio: 1,
						intersectionRect: {} as DOMRectReadOnly,
						isIntersecting: true,
						rootBounds: null,
						target,
						time: 0,
					} as unknown as IntersectionObserverEntry,
				],
				{} as IntersectionObserver,
			)
		})

		expect(
			screen
				.getAllByRole("link", { name: nextHeading.text })
				.some((link) => link.getAttribute("aria-current") === "location"),
		).toBe(true)
	})

	it("copies the current page as llm-readable markdown", async () => {
		const page = getRequiredDoc("plugins/overview")
		render(<DocsShell page={page} navigation={docsNavigation} />)

		const copyButton = screen.getAllByRole("button", { name: "Copy page" })[0]
		if (!copyButton) throw new Error("Missing copy page button")
		fireEvent.click(copyButton)

		await waitFor(() => {
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
				expect.stringContaining("# Community Plugins"),
			)
		})
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			expect.stringContaining("Source: http://localhost:3000/docs/plugins/overview"),
		)
	})
})
