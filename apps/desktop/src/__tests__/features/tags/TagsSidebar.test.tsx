import { cleanup, render, screen } from "@testing-library/react"
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
	useTagsStore: vi.fn(),
	useVaultStore: vi.fn(),
	useWorkspaceStore: vi.fn(),
}))

import { useTagsStore, useVaultStore, useWorkspaceStore } from "@cortex/core"
import { TagsSidebar } from "../../../features/tags/TagsSidebar"

const openTab = vi.fn()
const vault = {
	path: "/vault",
	name: "Test Vault",
	uuid: "vault-id",
}

function setupTagsSidebar() {
	const vaultState = { vault }
	vi.mocked(useVaultStore).mockImplementation(((
		selector?: (state: typeof vaultState) => unknown,
	) => (selector ? selector(vaultState) : vaultState)) as never)

	const workspaceState = { openTab }
	vi.mocked(useWorkspaceStore).mockImplementation(((
		selector?: (state: typeof workspaceState) => unknown,
	) => (selector ? selector(workspaceState) : workspaceState)) as never)

	const tagsState = {
		tagIndex: {
			Project: ["/vault/Projects/Plan.md", "/vault/Projects/Roadmap.md"],
			review: ["/vault/Reviews/Weekly.md"],
		},
		tagColors: {
			Project: "#7c3aed",
		},
	}
	vi.mocked(useTagsStore).mockImplementation(((selector?: (state: typeof tagsState) => unknown) =>
		selector ? selector(tagsState) : tagsState) as never)
}

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("TagsSidebar", () => {
	it("filters tags case-insensitively", async () => {
		setupTagsSidebar()
		render(<TagsSidebar />)

		await userEvent.type(screen.getByPlaceholderText("Filter tags..."), "PRO")

		expect(screen.getByText("Project")).toBeInTheDocument()
		expect(screen.queryByText("review")).not.toBeInTheDocument()
	})

	it("expands a tag into readable note rows and opens a note", async () => {
		setupTagsSidebar()
		render(<TagsSidebar />)

		await userEvent.click(screen.getByRole("button", { name: /Project/ }))

		expect(screen.getByText("Plan")).toBeInTheDocument()
		expect(screen.getByText("Roadmap")).toBeInTheDocument()
		expect(screen.getAllByText("Projects")).toHaveLength(2)

		await userEvent.click(screen.getByRole("button", { name: "Open Plan" }))

		expect(openTab).toHaveBeenCalledWith("/vault/Projects/Plan.md")
	})
})
