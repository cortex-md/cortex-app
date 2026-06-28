import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/core", () => ({
	useTemplateStore: vi.fn(),
	useUIStore: vi.fn(),
	useVaultStore: vi.fn(),
	useWorkspaceStore: vi.fn(),
}))

import { useTemplateStore, useUIStore, useVaultStore, useWorkspaceStore } from "@cortex/core"
import { CreateFromTemplateDialog } from "../../../features/templates/CreateFromTemplateDialog"

const ensureTemplatesLoaded = vi.fn().mockResolvedValue(undefined)
const previewNoteFromTemplate = vi.fn().mockResolvedValue({
	targetFolder: "Reviews",
	fileName: "weekly-review.md",
	content: "# Weekly Review",
})
const createNoteFromTemplate = vi.fn().mockResolvedValue("/vault/Reviews/weekly-review.md")
const closeCreateFromTemplate = vi.fn()
const openSettings = vi.fn()
const refreshFiles = vi.fn().mockResolvedValue(undefined)
const openTab = vi.fn()

const template = {
	id: "weekly",
	name: "Weekly Review",
	description: "",
	bodyPath: "weekly.md",
	targetFolderPattern: "Reviews",
	fileNamePattern: "{{ note.title | slug }}",
	createdAt: "2026-06-18T00:00:00.000Z",
	updatedAt: "2026-06-18T00:00:00.000Z",
}

const templateStoreState = {
	templates: [template],
	ensureTemplatesLoaded,
	previewNoteFromTemplate,
	createNoteFromTemplate,
}

beforeEach(() => {
	vi.mocked(useTemplateStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		return selector ? selector(templateStoreState) : templateStoreState
	}) as never)
	vi.mocked(useUIStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = {
			createFromTemplateOpen: true,
			closeCreateFromTemplate,
			openSettings,
		}
		return selector ? selector(state) : state
	}) as never)
	vi.mocked(useVaultStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = {
			vault: { path: "/vault", name: "Vault" },
			refreshFiles,
		}
		return selector ? selector(state) : state
	}) as never)
	vi.mocked(useWorkspaceStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = { openTab }
		return selector ? selector(state) : state
	}) as never)
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("CreateFromTemplateDialog", () => {
	it("creates a note and opens it", async () => {
		render(<CreateFromTemplateDialog />)

		expect(await screen.findByDisplayValue("weekly-review.md")).toBeInTheDocument()

		await userEvent.click(screen.getByRole("button", { name: "Create note" }))

		await waitFor(() => {
			expect(createNoteFromTemplate).toHaveBeenCalledWith(
				{ path: "/vault", name: "Vault" },
				expect.objectContaining({
					templateId: "weekly",
					targetFolder: "Reviews",
					fileName: "weekly-review.md",
				}),
			)
		})
		expect(refreshFiles).toHaveBeenCalled()
		expect(openTab).toHaveBeenCalledWith("/vault/Reviews/weekly-review.md")
		expect(closeCreateFromTemplate).toHaveBeenCalled()
	})
})
