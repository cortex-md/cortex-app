import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/core", () => ({
	getNotePathPresentation: (filePath: string, vaultPath?: string) => {
		const normalizedFilePath = filePath.replaceAll("\\", "/")
		const normalizedVaultPath = vaultPath?.replaceAll("\\", "/").replace(/\/+$/, "")
		const vaultPrefix = normalizedVaultPath ? `${normalizedVaultPath}/` : null
		const relativePath =
			vaultPrefix && normalizedFilePath.startsWith(vaultPrefix)
				? normalizedFilePath.slice(vaultPrefix.length)
				: normalizedFilePath
		const segments = relativePath.split("/").filter(Boolean)
		const fileName = segments.at(-1) ?? ""
		const title = fileName.replace(/\.md$/i, "")
		if (segments.length > 0) segments[segments.length - 1] = title
		return {
			title,
			segments: segments.map((label, index) => ({
				id: segments.slice(0, index + 1).join("/"),
				label,
			})),
		}
	},
	useVaultStore: vi.fn(),
	useWorkspaceStore: vi.fn(),
}))

vi.mock("@cortex/search", () => ({
	useSearchStore: vi.fn(),
}))

import { useVaultStore, useWorkspaceStore } from "@cortex/core"
import { useSearchStore } from "@cortex/search"
import { SearchSidebar } from "../../../features/search/SearchSidebar"

const openTab = vi.fn()
const search = vi.fn()
const setQuery = vi.fn()
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
	snippet: string
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
	const vaultState = { vault }
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
		search,
		setQuery,
		indexing,
	}
	vi.mocked(useSearchStore).mockImplementation(((
		selector?: (state: typeof searchState) => unknown,
	) => (selector ? selector(searchState) : searchState)) as never)
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
					snippet: "Draft plan for the alpha launch",
				},
			],
		})
		render(<SearchSidebar />)

		expect(screen.getByText("Plan")).toBeInTheDocument()
		expect(screen.getByText("Projects")).toBeInTheDocument()
		expect(document.querySelector(".sidebar-search-mark")).toHaveTextContent("plan")

		await userEvent.click(screen.getByRole("button", { name: "Open Plan" }))

		expect(openTab).toHaveBeenCalledWith("/vault/Projects/Plan.md")
	})

	it("passes text and filter tokens into the search store", async () => {
		setupSearchSidebar()
		render(<SearchSidebar />)

		fireEvent.change(screen.getByPlaceholderText("Search in vault..."), {
			target: { value: "roadmap tag:work path:Projects file:Plan" },
		})

		await waitFor(() =>
			expect(search).toHaveBeenLastCalledWith("roadmap", {
				tags: ["work"],
				folder: "Projects",
				files: ["Plan"],
			}),
		)
	})
})
