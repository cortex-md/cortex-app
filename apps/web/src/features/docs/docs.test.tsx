import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DocsShell } from "./components/DocsShell"
import { docsNavigation, docsSearchEntries, getDocBySlug } from "./registry"

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

const loadSearchEntries = async () => docsSearchEntries

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

	it("renders navigation, markdown content, cards, toc, and the sidebar command search", () => {
		const page = getRequiredDoc("plugins/overview")

		const { container } = render(
			<DocsShell page={page} navigation={docsNavigation} loadSearchEntries={loadSearchEntries} />,
		)

		expect(screen.getByRole("heading", { level: 1, name: "Community Plugins" })).toBeTruthy()
		expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeTruthy()
		expect(screen.getByRole("navigation", { name: "Docs navigation" })).toBeTruthy()
		expect(screen.getAllByRole("navigation", { name: "On this page" }).length).toBeGreaterThan(0)
		expect(
			screen
				.getAllByRole("link", { name: /Cortex CLI/i })
				.at(-1)
				?.getAttribute("href"),
		).toBe("/docs/developers/cli")
		expect(screen.getAllByRole("button", { name: "Search docs" }).length).toBeGreaterThan(0)
		expect(screen.queryByPlaceholderText("Search docs...")).toBeNull()
		expect(container.querySelector(".markdown-surface")).toBeTruthy()
		expect(container.querySelector(".cortex-docs-shiki")).toBeTruthy()
		expect(container.querySelector("[data-code-meta]")).toBeTruthy()
	})

	it("opens command search with mod+k and includes pages and headings", async () => {
		const page = getRequiredDoc("plugins/overview")
		render(
			<DocsShell page={page} navigation={docsNavigation} loadSearchEntries={loadSearchEntries} />,
		)

		fireEvent.keyDown(window, { key: "k", metaKey: true })

		expect(await screen.findByPlaceholderText("Search docs...")).toBeTruthy()
		expect((await screen.findAllByText("Sync Overview")).length).toBeGreaterThan(0)
		expect((await screen.findAllByText("Extension surfaces")).length).toBeGreaterThan(0)
	})

	it("marks the active toc heading as the observer changes sections", () => {
		const page = getRequiredDoc("plugins/overview")
		const nextHeading = page.headings[1]
		if (!nextHeading) throw new Error("Missing docs heading fixture")
		render(
			<DocsShell page={page} navigation={docsNavigation} loadSearchEntries={loadSearchEntries} />,
		)

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
		render(
			<DocsShell page={page} navigation={docsNavigation} loadSearchEntries={loadSearchEntries} />,
		)

		const copyButton = screen.getAllByRole("button", { name: "Copy page as Markdown" })[0]
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
