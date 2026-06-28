import { act, cleanup, render, screen } from "@testing-library/react"
import { FolderIcon, SearchIcon, TagIcon } from "lucide-react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SidebarViewStage } from "../../../features/file-explorer/SidebarViewStage"
import {
	getSidebarViewDirection,
	type SidebarViewItem,
	type SidebarViewPanelProps,
} from "../../../features/file-explorer/sidebarViewUtils"

const items: SidebarViewItem[] = [
	{ id: "files", label: "Files", icon: FolderIcon, source: "core" },
	{ id: "search", label: "Search", icon: SearchIcon, source: "core" },
	{ id: "tags", label: "Tags", icon: TagIcon, source: "core" },
]

function TestSidebarViewPanel({ id }: SidebarViewPanelProps) {
	return <div data-testid={`view-${id}`}>{id}</div>
}

afterEach(() => {
	cleanup()
	vi.useRealTimers()
})

describe("SidebarViewStage", () => {
	it("animates both panels in the selected direction", () => {
		const { rerender } = render(
			<SidebarViewStage activeId="files" items={items} ViewComponent={TestSidebarViewPanel} />,
		)

		rerender(
			<SidebarViewStage activeId="search" items={items} ViewComponent={TestSidebarViewPanel} />,
		)

		expect(screen.getByTestId("view-files")).toBeInTheDocument()
		expect(screen.getByTestId("view-search")).toBeInTheDocument()
		expect(screen.getByRole("tabpanel")).toHaveAttribute("data-direction", "forward")
		expect(document.querySelector(".sidebar-view-panel--previous")).toHaveAttribute(
			"data-direction",
			"forward",
		)
	})

	it("keeps only the latest two panels during rapid navigation", () => {
		vi.useFakeTimers()
		const { rerender } = render(
			<SidebarViewStage activeId="files" items={items} ViewComponent={TestSidebarViewPanel} />,
		)

		rerender(
			<SidebarViewStage activeId="search" items={items} ViewComponent={TestSidebarViewPanel} />,
		)
		rerender(
			<SidebarViewStage activeId="tags" items={items} ViewComponent={TestSidebarViewPanel} />,
		)

		expect(screen.queryByTestId("view-files")).not.toBeInTheDocument()
		expect(screen.getByTestId("view-search")).toBeInTheDocument()
		expect(screen.getByTestId("view-tags")).toBeInTheDocument()

		act(() => vi.advanceTimersByTime(220))

		expect(screen.queryByTestId("view-search")).not.toBeInTheDocument()
		expect(screen.getByTestId("view-tags")).toBeInTheDocument()
	})
})

describe("getSidebarViewDirection", () => {
	it("uses the registered order for forward and backward motion", () => {
		expect(getSidebarViewDirection(items, "files", "tags")).toBe("forward")
		expect(getSidebarViewDirection(items, "tags", "search")).toBe("backward")
	})
})
