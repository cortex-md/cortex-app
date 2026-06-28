import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/core", () => ({
	useEditorStore: vi.fn(),
	useTagsStore: vi.fn(),
	useUIStore: vi.fn(),
	useVaultStore: vi.fn(),
}))

import { useEditorStore, useTagsStore, useUIStore, useVaultStore } from "@cortex/core"
import { TagPicker } from "../../../features/tags/TagPicker"

const addTagToFile = vi.fn().mockResolvedValue(undefined)
const removeTagFromFile = vi.fn().mockResolvedValue(undefined)
const setTagColor = vi.fn()
const toggleTagPicker = vi.fn()

const activeFilePath = "/vault/Notes/Plan.md"
const vault = {
	path: "/vault",
	name: "Test Vault",
	uuid: "vault-id",
}

function setupTagPicker() {
	const uiState = {
		tagPickerOpen: true,
		toggleTagPicker,
	}
	vi.mocked(useUIStore).mockImplementation(((selector?: (state: typeof uiState) => unknown) =>
		selector ? selector(uiState) : uiState) as never)

	const editorState = {
		activeFilePath,
	}
	vi.mocked(useEditorStore).mockImplementation(((
		selector?: (state: typeof editorState) => unknown,
	) => (selector ? selector(editorState) : editorState)) as never)

	const vaultState = {
		vault,
	}
	vi.mocked(useVaultStore).mockImplementation(((
		selector?: (state: typeof vaultState) => unknown,
	) => (selector ? selector(vaultState) : vaultState)) as never)

	const tagsState = {
		tagIndex: {
			project: [activeFilePath, "/vault/Notes/Roadmap.md"],
			review: ["/vault/Notes/Review.md"],
		},
		tagColors: {
			project: "#7c3aed",
		},
		fileTags: {
			[activeFilePath]: ["project"],
		},
		setTagColor,
		addTagToFile,
		removeTagFromFile,
	}
	vi.mocked(useTagsStore).mockImplementation(((selector?: (state: typeof tagsState) => unknown) =>
		selector ? selector(tagsState) : tagsState) as never)
}

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("TagPicker", () => {
	it("toggles existing tags and shows keyboard hints", async () => {
		setupTagPicker()
		render(<TagPicker />)

		await userEvent.click(screen.getByText("review"))

		expect(addTagToFile).toHaveBeenCalledWith(activeFilePath, "review")
		expect(screen.getByText("toggle")).toBeInTheDocument()
		expect(screen.getByText("2 notes")).toBeInTheDocument()
	})

	it("creates a tag from the search value", async () => {
		setupTagPicker()
		render(<TagPicker />)

		await userEvent.type(screen.getByPlaceholderText("Search or create tag..."), "idea")
		await userEvent.click(screen.getAllByText('Create tag "idea"')[0])

		expect(addTagToFile).toHaveBeenCalledWith(activeFilePath, "idea")
		expect(toggleTagPicker).toHaveBeenCalled()
	})

	it("opens the color panel and clears a tag color", async () => {
		setupTagPicker()
		render(<TagPicker />)

		await userEvent.click(screen.getByRole("button", { name: "Set color for project" }))
		expect(screen.getByText("Color for project")).toBeInTheDocument()

		await userEvent.click(screen.getByRole("button", { name: "Clear" }))

		expect(setTagColor).toHaveBeenCalledWith("/vault", "project", null)
	})
})
