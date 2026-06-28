import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const openTab = vi.fn()
const removeBookmark = vi.fn().mockResolvedValue(undefined)

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
	resolveBookmarkPath: (vaultPath: string, bookmarkPath: string) => `${vaultPath}/${bookmarkPath}`,
	useBookmarksStore: vi.fn(),
	useVaultStore: vi.fn(),
	useWorkspaceStore: vi.fn(),
}))

import { useBookmarksStore, useVaultStore, useWorkspaceStore } from "@cortex/core"
import { BookmarksSidebar } from "../../../features/bookmarks/BookmarksSidebar"

const vault = {
	path: "/vault",
	name: "Test Vault",
	uuid: "vault-id",
}

const bookmarks = [
	{ path: "Projects/Plan.md", addedAt: 1 },
	{ path: "Projects/Roadmap.md", addedAt: 2 },
	{ path: "Missing.md", addedAt: 3 },
]

function setupBookmarksSidebar() {
	const vaultState = {
		vault,
		files: [
			{ path: "/vault/Projects/Plan.md", name: "Plan.md", isDir: false },
			{ path: "/vault/Projects/Roadmap.md", name: "Roadmap.md", isDir: false },
		],
	}
	vi.mocked(useVaultStore).mockImplementation(((
		selector?: (state: typeof vaultState) => unknown,
	) => (selector ? selector(vaultState) : vaultState)) as never)

	const bookmarksState = {
		bookmarks,
		removeBookmark,
	}
	vi.mocked(useBookmarksStore).mockImplementation(((
		selector?: (state: typeof bookmarksState) => unknown,
	) => (selector ? selector(bookmarksState) : bookmarksState)) as never)

	const workspaceState = {
		openTab,
		activePaneId: "pane-1",
		panes: {
			"pane-1": {
				activeTabId: "tab-1",
				tabs: [
					{
						id: "tab-1",
						filePath: "/vault/Projects/Plan.md",
					},
				],
			},
		},
	}
	vi.mocked(useWorkspaceStore).mockImplementation(((
		selector?: (state: typeof workspaceState) => unknown,
	) => (selector ? selector(workspaceState) : workspaceState)) as never)
}

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("BookmarksSidebar", () => {
	it("filters bookmarks and opens existing notes", async () => {
		setupBookmarksSidebar()
		render(<BookmarksSidebar />)

		await userEvent.type(screen.getByPlaceholderText("Filter bookmarks..."), "road")

		expect(screen.queryByText("Plan")).not.toBeInTheDocument()
		expect(screen.getByText("Roadmap")).toBeInTheDocument()
		expect(screen.queryByText("Local")).not.toBeInTheDocument()
		expect(screen.queryByText("Sync on")).not.toBeInTheDocument()
		expect(screen.queryByText("Vault root")).not.toBeInTheDocument()
		expect(screen.queryByText("Move Up")).not.toBeInTheDocument()
		expect(screen.queryByText("Move Down")).not.toBeInTheDocument()
		expect(
			screen.queryByRole("button", { name: "Bookmark actions for Roadmap" }),
		).not.toBeInTheDocument()

		await userEvent.click(screen.getByRole("button", { name: "Open Roadmap" }))

		expect(openTab).toHaveBeenCalledWith("/vault/Projects/Roadmap.md")
	})

	it("removes bookmarks and shows missing notes", async () => {
		setupBookmarksSidebar()
		render(<BookmarksSidebar />)

		expect(screen.getByText("Not found")).toBeInTheDocument()
		expect(
			screen.getByRole("button", { name: "Open Plan" }).closest(".sidebar-bookmark-row"),
		).toHaveClass("active")
		await userEvent.click(screen.getByRole("button", { name: "Remove Roadmap from bookmarks" }))

		expect(removeBookmark).toHaveBeenCalledWith("/vault", "Projects/Roadmap.md")
	})
})
