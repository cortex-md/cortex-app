import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/core", async (importOriginal) => ({
	...(await importOriginal<typeof import("@cortex/core")>()),
	useTagsStore: vi.fn(),
	useVaultStore: vi.fn(),
	useWorkspaceStore: vi.fn(),
}))

import { useTagsStore, useVaultStore, useWorkspaceStore } from "@cortex/core"
import { TagsSidebar } from "../../../features/tags/TagsSidebar"

const openViewTab = vi.fn()
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
	Object.assign(useVaultStore, { getState: () => vaultState })

	const workspaceState = { openViewTab, activePaneId: "root", panes: {} }
	vi.mocked(useWorkspaceStore).mockImplementation(((
		selector?: (state: typeof workspaceState) => unknown,
	) => (selector ? selector(workspaceState) : workspaceState)) as never)
	Object.assign(useWorkspaceStore, { getState: () => workspaceState })

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

	it("opens the tag page for a tag", async () => {
		setupTagsSidebar()
		render(<TagsSidebar />)

		await userEvent.click(screen.getByRole("button", { name: "Open #Project" }))

		expect(openViewTab).toHaveBeenCalledWith("tag", "#Project", {
			viewState: { tag: "Project" },
			forceNew: true,
		})
	})
})
