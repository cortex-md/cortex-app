import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/core", async (importOriginal) => ({
	...(await importOriginal<typeof import("@cortex/core")>()),
	useUIStore: vi.fn(),
	useVaultStore: vi.fn(),
	useWorkspaceStore: vi.fn(),
}))

vi.mock("@cortex/search", async (importOriginal) => ({
	...(await importOriginal<typeof import("@cortex/search")>()),
	useSearchStore: vi.fn(),
}))

import { useUIStore, useVaultStore, useWorkspaceStore } from "@cortex/core"
import { useSearchStore } from "@cortex/search"
import { QuickFinder } from "../../../features/quick-finder/QuickFinder"

const toggleQuickFinder = vi.fn()
const createFile = vi.fn().mockResolvedValue("/vault/New Note.md")
const openTab = vi.fn()
const searchTitles = vi.fn()

const vault = {
	path: "/vault",
	name: "Test Vault",
	uuid: "vault-id",
}
const quickFinderPlaceholder = "Find or create a note..."

function quickFinderPath(path: string) {
	return (_content: string, element: Element | null) =>
		element?.classList.contains("quick-finder-path") === true && element.textContent === path
}

function setupQuickFinder({
	recentlyClosed = [],
	searchResults = [],
}: {
	recentlyClosed?: Array<{ filePath: string; title: string; closedAt: number }>
	searchResults?: Array<{ id: string; title: string; folder: string }>
} = {}) {
	searchTitles.mockReturnValue(
		searchResults.map((result) => ({ ...result, matchCount: 0, snippets: [] })),
	)

	const uiState = {
		quickFinderOpen: true,
		quickFinderRequest: { kind: "open" },
		quickFinderPreview: false,
		toggleQuickFinder,
	}
	vi.mocked(useUIStore).mockImplementation(((selector?: (state: typeof uiState) => unknown) =>
		selector ? selector(uiState) : uiState) as never)

	const vaultState = {
		vault,
		files: [],
		createFile,
	}
	vi.mocked(useVaultStore).mockImplementation(((
		selector?: (state: typeof vaultState) => unknown,
	) => (selector ? selector(vaultState) : vaultState)) as never)

	const workspaceState = {
		activePaneId: "root",
		openTab,
		panes: {
			root: {
				id: "root",
				activeTabId: "tab-1",
				tabs: [
					{
						id: "tab-1",
						tabType: "file",
						fileKind: "markdown",
						filePath: "/vault/Journal/Daily.md",
						title: "Daily",
						lastAccessed: 20,
					},
					{
						id: "tab-2",
						tabType: "file",
						fileKind: "markdown",
						filePath: "/vault/Projects/Roadmap.md",
						title: "Roadmap",
						lastAccessed: 10,
					},
				],
			},
		},
		recentlyClosed,
	}
	vi.mocked(useWorkspaceStore).mockImplementation(((
		selector?: (state: typeof workspaceState) => unknown,
	) => (selector ? selector(workspaceState) : workspaceState)) as never)

	const searchState = {
		searchTitles,
		findNotes: () => [],
		loadMatches: async () => [],
	}
	vi.mocked(useSearchStore).mockImplementation(((
		selector?: (state: typeof searchState) => unknown,
	) => (selector ? selector(searchState) : searchState)) as never)
	Object.assign(useSearchStore, { getState: () => searchState })
}

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
	createFile.mockResolvedValue("/vault/New Note.md")
})

describe("QuickFinder", () => {
	it("shows recent notes before searching", () => {
		setupQuickFinder({
			recentlyClosed: [{ filePath: "/vault/Archive/Closed.md", title: "Closed", closedAt: 1 }],
		})

		render(<QuickFinder />)

		expect(screen.getByText(quickFinderPath("Journal/Daily"))).toBeInTheDocument()
		expect(screen.getByText(quickFinderPath("Projects/Roadmap"))).toBeInTheDocument()
		expect(screen.getByText(quickFinderPath("Archive/Closed"))).toBeInTheDocument()
		expect(screen.getByText("new tab")).toBeInTheDocument()
		expect(screen.getByText("open right")).toBeInTheDocument()
	})

	it("opens a searched note", async () => {
		setupQuickFinder({
			searchResults: [{ id: "Projects/Plan.md", title: "Plan", folder: "Projects" }],
		})
		render(<QuickFinder />)

		await userEvent.type(screen.getByPlaceholderText(quickFinderPlaceholder), "plan")
		await userEvent.click(screen.getByText(quickFinderPath("Projects/Plan")))

		expect(openTab).toHaveBeenCalledWith("/vault/Projects/Plan.md", undefined)
		expect(toggleQuickFinder).toHaveBeenCalled()
	})

	it("repeats the folder path inline for each matching note", async () => {
		setupQuickFinder({
			searchResults: [
				{
					id: "Contestacao de fraude/Chargeback.md",
					title: "Chargeback",
					folder: "Contestacao de fraude",
				},
				{
					id: "Contestacao de fraude/Disputa.md",
					title: "Disputa",
					folder: "Contestacao de fraude",
				},
			],
		})
		render(<QuickFinder />)

		await userEvent.type(screen.getByPlaceholderText(quickFinderPlaceholder), "contestacao")

		expect(
			screen.getByText(quickFinderPath("Contestacao de fraude/Chargeback")),
		).toBeInTheDocument()
		expect(screen.getByText(quickFinderPath("Contestacao de fraude/Disputa"))).toBeInTheDocument()
	})

	it("opens the selected note in the active pane with Command Enter", async () => {
		setupQuickFinder({
			searchResults: [{ id: "Projects/Plan.md", title: "Plan", folder: "Projects" }],
		})
		render(<QuickFinder />)

		const input = screen.getByPlaceholderText(quickFinderPlaceholder)
		await userEvent.type(input, "plan")
		fireEvent.keyDown(input, { key: "Enter", metaKey: true })

		expect(openTab).toHaveBeenCalledWith("/vault/Projects/Plan.md", { paneId: "root" })
		expect(toggleQuickFinder).toHaveBeenCalled()
	})

	it("opens the keyboard-selected search result with Enter", async () => {
		setupQuickFinder({
			searchResults: [
				{ id: "Projects/Plan.md", title: "Plan", folder: "Projects" },
				{ id: "Projects/Planet.md", title: "Planet", folder: "Projects" },
			],
		})
		render(<QuickFinder />)

		const input = screen.getByPlaceholderText(quickFinderPlaceholder)
		await userEvent.type(input, "plan")
		await userEvent.keyboard("{ArrowDown}")
		fireEvent.keyDown(input, { key: "Enter" })

		expect(openTab).toHaveBeenCalledWith("/vault/Projects/Planet.md", undefined)
		expect(toggleQuickFinder).toHaveBeenCalled()
	})

	it("opens the selected note in a split with Control Shift Enter", async () => {
		setupQuickFinder({
			searchResults: [{ id: "Projects/Plan.md", title: "Plan", folder: "Projects" }],
		})
		render(<QuickFinder />)

		const input = screen.getByPlaceholderText(quickFinderPlaceholder)
		await userEvent.type(input, "plan")
		fireEvent.keyDown(input, { key: "Enter", ctrlKey: true, shiftKey: true })

		expect(openTab).toHaveBeenCalledWith("/vault/Projects/Plan.md", {
			paneId: "root",
			split: "horizontal",
		})
		expect(toggleQuickFinder).toHaveBeenCalled()
	})

	it("creates a note from the selectable create item", async () => {
		setupQuickFinder()
		render(<QuickFinder />)

		await userEvent.type(screen.getByPlaceholderText(quickFinderPlaceholder), "New Note")
		expect(screen.getByText("Enter to create")).toBeInTheDocument()
		expect(screen.queryByText(quickFinderPath("Journal/Daily"))).not.toBeInTheDocument()
		await userEvent.click(screen.getByText("New Note"))

		await waitFor(() => {
			expect(createFile).toHaveBeenCalledWith("/vault", "New Note")
		})
		expect(openTab).toHaveBeenCalledWith("/vault/New Note.md")
		expect(toggleQuickFinder).toHaveBeenCalled()
	})

	it("creates a note with Shift Enter", async () => {
		setupQuickFinder()
		render(<QuickFinder />)

		const input = screen.getByPlaceholderText(quickFinderPlaceholder)
		await userEvent.type(input, "Alias Note")
		fireEvent.keyDown(input, { key: "Enter", shiftKey: true })

		await waitFor(() => {
			expect(createFile).toHaveBeenCalledWith("/vault", "Alias Note")
		})
		expect(openTab).toHaveBeenCalledWith("/vault/New Note.md")
		expect(toggleQuickFinder).toHaveBeenCalled()
	})
})
