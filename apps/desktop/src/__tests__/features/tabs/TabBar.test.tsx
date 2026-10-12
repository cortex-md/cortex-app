import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TabBar } from "../../../features/tabs/TabBar"

const { dragState } = vi.hoisted(() => ({
	dragState: {
		dropTarget: null,
		updateDragPosition: vi.fn(),
		updateDropTarget: vi.fn(),
		startDrag: vi.fn(),
		completeDrop: vi.fn(),
		cancelDrag: vi.fn(),
	},
}))

vi.mock("@cortex/core", () => {
	const useDragStore = Object.assign(
		vi.fn((selector?: (state: typeof dragState) => unknown) =>
			selector ? selector(dragState) : dragState,
		),
		{ getState: () => dragState },
	)
	const createStore = (state: Record<string, unknown>) =>
		vi.fn((selector?: (value: Record<string, unknown>) => unknown) =>
			selector ? selector(state) : state,
		)
	return {
		useDragStore,
		useWorkspaceStore: createStore({ navigation: {} }),
		useUIStore: createStore({ rightSidebarCollapsed: true }),
		useVaultStore: createStore({ vault: null, files: [] }),
		canStepNavigationHistory: () => false,
		formatRelativeTime: () => "",
		getFileModifiedTimes: () => new Map(),
		getNotePathPresentation: () => ({ title: "", segments: [] }),
	}
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
	vi.useRealTimers()
})

describe("TabBar", () => {
	it("preserves document tab behavior and drop attributes", () => {
		const onActivate = vi.fn()
		const onClose = vi.fn()

		const { container } = render(
			<TabBar
				tabs={[
					{ id: "tab-1", title: "Alpha", isPinned: false },
					{ id: "tab-2", title: "Beta", isPinned: false },
				]}
				activeTabId="tab-1"
				paneId="pane-1"
				onActivate={onActivate}
				onClose={onClose}
			/>,
		)

		const activeTab = screen.getByRole("tab", { name: /Alpha/ })
		const inactiveTab = screen.getByRole("tab", { name: /Beta/ })
		const tabBar = container.querySelector(".tab-bar-row")

		expect(activeTab).toHaveAttribute("aria-selected", "true")
		expect(inactiveTab).toHaveAttribute("aria-selected", "false")
		expect(activeTab).toHaveAttribute("data-drop-tab-id", "tab-1")
		expect(activeTab).toHaveAttribute("data-drop-tab-index", "0")
		expect(activeTab).toHaveAttribute("data-drop-tab-pane-id", "pane-1")
		expect(tabBar).toHaveAttribute("data-drop-tabbar-count", "2")
		expect(tabBar).toHaveAttribute("data-drop-tabbar-pane-id", "pane-1")

		fireEvent.click(inactiveTab)

		expect(onActivate).toHaveBeenCalledWith("tab-2")
	})

	it("closes a tab immediately", () => {
		const onClose = vi.fn()

		render(
			<TabBar
				tabs={[{ id: "tab-1", title: "Alpha", isPinned: false }]}
				activeTabId="tab-1"
				paneId="pane-1"
				onActivate={vi.fn()}
				onClose={onClose}
			/>,
		)

		fireEvent.click(screen.getByLabelText("Close Alpha"))

		expect(onClose).toHaveBeenCalledWith("tab-1")
	})
})
