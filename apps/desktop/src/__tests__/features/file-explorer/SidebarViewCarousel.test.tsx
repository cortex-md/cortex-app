import { useDragStore } from "@cortex/core"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BookmarkIcon, FolderIcon, SearchIcon, TagIcon } from "lucide-react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SidebarViewCarousel } from "../../../features/file-explorer/SidebarViewCarousel"
import {
	calculateSidebarViewScrollLeft,
	getAvailableSidebarViewId,
	getSidebarViewLabelMaxWidth,
	type SidebarViewItem,
} from "../../../features/file-explorer/sidebarViewUtils"

const items: SidebarViewItem[] = [
	{ id: "files", label: "Files", icon: FolderIcon, source: "core" },
	{ id: "search", label: "Search", icon: SearchIcon, source: "core" },
	{ id: "bookmarks", label: "Bookmarks", icon: BookmarkIcon, source: "core" },
	{ id: "tags", label: "Tags", icon: TagIcon, source: "core" },
	{
		id: "emoji-browser",
		viewId: "emoji-browser",
		label: "Emoji",
		icon: "smile",
		source: "extension",
	},
]

beforeEach(() => {
	useDragStore.setState({ dragSource: null, dropTarget: null })
	vi.mocked(Element.prototype.scrollTo).mockClear()
})

afterEach(() => {
	cleanup()
	delete document.body.dataset.reducedMotion
	vi.clearAllMocks()
})

describe("SidebarViewCarousel", () => {
	it("shows only the active label and keeps active clicks inert", async () => {
		const onSelect = vi.fn()
		const user = userEvent.setup()
		render(<SidebarViewCarousel items={items} activeId="files" onSelect={onSelect} />)

		expect(screen.getByText("Files")).toBeInTheDocument()
		expect(screen.queryByText("Search")).not.toBeInTheDocument()

		await user.click(screen.getByRole("tab", { name: "Files" }))
		expect(onSelect).not.toHaveBeenCalled()

		await user.click(screen.getByRole("tab", { name: "Search" }))
		expect(onSelect).toHaveBeenCalledWith("search")
	})

	it("supports roving keyboard focus and native activation", async () => {
		const onSelect = vi.fn()
		const user = userEvent.setup()
		render(<SidebarViewCarousel items={items} activeId="files" onSelect={onSelect} />)

		const files = screen.getByRole("tab", { name: "Files" })
		const search = screen.getByRole("tab", { name: "Search" })
		const emoji = screen.getByRole("tab", { name: "Emoji" })
		files.focus()

		await user.keyboard("{ArrowRight}")
		expect(search).toHaveFocus()
		await user.keyboard("{Enter}")
		expect(onSelect).toHaveBeenCalledWith("search")

		await user.keyboard("{End}")
		expect(emoji).toHaveFocus()
		await user.keyboard("{Home}")
		expect(files).toHaveFocus()
	})

	it("opens a searchable picker grouped by source", async () => {
		const onSelect = vi.fn()
		const user = userEvent.setup()
		render(<SidebarViewCarousel items={items} activeId="files" onSelect={onSelect} />)

		await user.click(screen.getByRole("button", { name: "All sidebar views" }))

		expect(screen.getByPlaceholderText("Find a view...")).toBeInTheDocument()
		expect(screen.getByText("Cortex")).toBeInTheDocument()
		expect(screen.getByText("Extensions")).toBeInTheDocument()

		await user.click(screen.getByText("Emoji"))
		expect(onSelect).toHaveBeenCalledWith("emoji-browser")
		expect(screen.queryByPlaceholderText("Find a view...")).not.toBeInTheDocument()
	})

	it("keeps the picker available and constrains long active labels in narrow sidebars", async () => {
		const currentResizeObserver = globalThis.ResizeObserver
		class NarrowResizeObserver {
			constructor(private readonly callback: ResizeObserverCallback) {}

			observe() {
				this.callback([{ contentRect: { width: 180 } } as ResizeObserverEntry], this)
			}

			unobserve() {}

			disconnect() {}
		}

		vi.stubGlobal("ResizeObserver", NarrowResizeObserver)
		try {
			render(<SidebarViewCarousel items={items} activeId="bookmarks" onSelect={vi.fn()} />)

			await waitFor(() => {
				expect(screen.getByRole("navigation", { name: "Sidebar views" })).toHaveStyle({
					"--sidebar-active-label-max-width": "53px",
				})
			})

			expect(screen.getByText("Bookmarks")).toBeInTheDocument()
			expect(screen.getByRole("button", { name: "All sidebar views" })).toBeInTheDocument()
		} finally {
			vi.stubGlobal("ResizeObserver", currentResizeObserver)
		}
	})

	it("centers the active item and respects reduced motion", async () => {
		const { rerender } = render(
			<SidebarViewCarousel items={items} activeId="files" onSelect={vi.fn()} />,
		)

		await waitFor(() => {
			expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith({
				behavior: "smooth",
				left: 0,
			})
		})

		document.body.dataset.reducedMotion = "true"
		rerender(<SidebarViewCarousel items={items} activeId="search" onSelect={vi.fn()} />)

		await waitFor(() => {
			expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith({
				behavior: "auto",
				left: 0,
			})
		})
	})

	it("preserves sidebar view drag sources", () => {
		render(<SidebarViewCarousel items={items} activeId="files" onSelect={vi.fn()} />)
		const emoji = screen.getByRole("tab", { name: "Emoji" })

		fireEvent.pointerDown(emoji, {
			button: 0,
			clientX: 0,
			clientY: 0,
			isPrimary: true,
		})
		fireEvent.pointerMove(document, { clientX: 8, clientY: 0, isPrimary: true })

		expect(useDragStore.getState().dragSource).toEqual({
			type: "sidebar-view",
			viewId: "emoji-browser",
			viewTitle: "Emoji",
		})

		fireEvent.pointerCancel(document, { isPrimary: true })
	})
})

describe("getSidebarViewLabelMaxWidth", () => {
	it("keeps active labels visible while scaling their available width", () => {
		expect(getSidebarViewLabelMaxWidth(0)).toBe(120)
		expect(getSidebarViewLabelMaxWidth(180)).toBe(53)
		expect(getSidebarViewLabelMaxWidth(240)).toBe(74)
		expect(getSidebarViewLabelMaxWidth(400)).toBe(120)
	})
})

describe("calculateSidebarViewScrollLeft", () => {
	const buttons = [
		{ left: 8, width: 34 },
		{ left: 48, width: 110 },
		{ left: 164, width: 34 },
		{ left: 204, width: 72 },
		{ left: 282, width: 34 },
	]

	it("centers a wide active capsule from its measured size", () => {
		expect(
			calculateSidebarViewScrollLeft({
				activeIndex: 1,
				buttons,
				viewportWidth: 180,
				scrollWidth: 324,
				paddingStart: 8,
				paddingEnd: 8,
			}),
		).toBe(13)
	})

	it("centers the active item with both neighbors when the group fits", () => {
		expect(
			calculateSidebarViewScrollLeft({
				activeIndex: 3,
				buttons,
				viewportWidth: 180,
				scrollWidth: 400,
				paddingStart: 8,
				paddingEnd: 8,
			}),
		).toBe(150)
	})

	it("clamps the first and last items to the scrollable limits", () => {
		expect(
			calculateSidebarViewScrollLeft({
				activeIndex: 0,
				buttons,
				viewportWidth: 180,
				scrollWidth: 324,
			}),
		).toBe(0)
		expect(
			calculateSidebarViewScrollLeft({
				activeIndex: 4,
				buttons,
				viewportWidth: 180,
				scrollWidth: 324,
			}),
		).toBe(144)
	})

	it("recalculates from the available viewport width", () => {
		const narrow = calculateSidebarViewScrollLeft({
			activeIndex: 2,
			buttons,
			viewportWidth: 120,
			scrollWidth: 324,
		})
		const wide = calculateSidebarViewScrollLeft({
			activeIndex: 2,
			buttons,
			viewportWidth: 240,
			scrollWidth: 324,
		})

		expect(narrow).toBeGreaterThan(wide)
	})
})

describe("getAvailableSidebarViewId", () => {
	it("falls back to files when an active plugin view disappears", () => {
		expect(getAvailableSidebarViewId(items, "emoji-browser")).toBe("emoji-browser")
		expect(getAvailableSidebarViewId(items.slice(0, 4), "emoji-browser")).toBe("files")
	})
})
