import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/core", async (importOriginal) => ({
	...(await importOriginal<typeof import("@cortex/core")>()),
	joinPath: (parentPath: string, name: string) => `${parentPath}/${name}`,
	getFolderNoteCounts: () => [],
	selectSortedTags: () => [],
	useTagsStore: (selector: (state: unknown) => unknown) =>
		selector({ tagIndex: {}, tagColors: {} }),
	useVaultStore: vi.fn(),
	useWorkspaceStore: Object.assign(vi.fn(), { getState: () => ({ openTab }) }),
}))

vi.mock("@cortex/search", async (importOriginal) => ({
	...(await importOriginal<typeof import("@cortex/search")>()),
	useSearchStore: vi.fn(),
}))

import { useVaultStore, useWorkspaceStore } from "@cortex/core"
import { useSearchStore } from "@cortex/search"
import { SearchSidebar } from "../../../features/search/SearchSidebar"

const { openTab } = vi.hoisted(() => ({ openTab: vi.fn() }))
const runQuery = vi.fn()
const setNoteHighlight = vi.fn()
const vault = {
	path: "/vault",
	name: "Test Vault",
	uuid: "vault-id",
}

interface SearchResultFixture {
	id: string
	title: string
	folder: string
	score: number
	matchedFields: string[]
	matchCount: number
	snippets: Array<{ text: string; ranges: Array<readonly [number, number]> }>
}

function setupSearchSidebar({
	query = "",
	results = [],
	indexing = false,
}: {
	query?: string
	results?: SearchResultFixture[]
	indexing?: boolean
} = {}) {
	const vaultState = { vault, files: [] }
	vi.mocked(useVaultStore).mockImplementation(((
		selector?: (state: typeof vaultState) => unknown,
	) => (selector ? selector(vaultState) : vaultState)) as never)

	const workspaceState = { openTab }
	vi.mocked(useWorkspaceStore).mockImplementation(((
		selector?: (state: typeof workspaceState) => unknown,
	) => (selector ? selector(workspaceState) : workspaceState)) as never)

	const searchState = {
		query,
		results,
		runQuery,
		indexing,
		recentQueries: [],
		setNoteHighlight,
		addRecentQuery: vi.fn(),
	}
	vi.mocked(useSearchStore).mockImplementation(((
		selector?: (state: typeof searchState) => unknown,
	) => (selector ? selector(searchState) : searchState)) as never)
	Object.assign(useSearchStore, { getState: () => searchState })
}

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("SearchSidebar", () => {
	it("renders result hierarchy and opens the selected note", async () => {
		setupSearchSidebar({
			query: "plan",
			results: [
				{
					id: "Projects/Plan.md",
					title: "Plan",
					folder: "Projects",
					score: 1,
					matchedFields: ["content"],
					matchCount: 1,
					snippets: [{ text: "Draft plan for the alpha launch", ranges: [[6, 10]] }],
				},
			],
		})
		render(<SearchSidebar />)

		expect(screen.getByText("Plan")).toBeInTheDocument()
		expect(screen.getByText("Projects")).toBeInTheDocument()
		expect(document.querySelector(".sidebar-search-mark")).toHaveTextContent("plan")

		await userEvent.click(screen.getByRole("button", { name: /Draft plan/ }))

		expect(setNoteHighlight).toHaveBeenCalledWith({
			filePath: "/vault/Projects/Plan.md",
			query: "plan",
			matchIndex: 0,
		})
		expect(openTab).toHaveBeenCalledWith("/vault/Projects/Plan.md")
	})

	it("passes text and filter tokens into the search store", async () => {
		setupSearchSidebar()
		render(<SearchSidebar />)

		fireEvent.change(screen.getByPlaceholderText("Search in vault..."), {
			target: { value: "roadmap tag:work path:Projects file:Plan" },
		})

		await waitFor(() =>
			expect(runQuery).toHaveBeenLastCalledWith("roadmap tag:work path:Projects file:Plan"),
		)
	})
})
