import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/core", () => ({
	useSyncStore: vi.fn(),
	useVaultStore: vi.fn(),
}))

vi.mock("../../../features/sync/ConflictDiffView", () => ({
	ConflictDiffView: ({ onClose }: { onClose: () => void }) => (
		<button type="button" onClick={onClose}>
			Close Diff
		</button>
	),
}))

import { useSyncStore, useVaultStore } from "@cortex/core"
import { ConflictBanner } from "../../../features/sync/ConflictBanner"

const mockVault = { path: "/my/vault", name: "Test", uuid: "vault-id" }

function setupMocks(overrides: {
	vault?: typeof mockVault | null
	conflicts?: Record<string, unknown>
	resolveConflict?: ReturnType<typeof vi.fn>
}) {
	const resolveConflict = overrides.resolveConflict ?? vi.fn()

	vi.mocked(useVaultStore).mockImplementation(((selector?: (s: unknown) => unknown) => {
		const state = { vault: overrides.vault ?? mockVault }
		return selector ? selector(state) : state
	}) as never)
	vi.mocked(useSyncStore).mockImplementation(((selector?: (s: unknown) => unknown) => {
		const state = { conflicts: overrides.conflicts ?? {}, resolveConflict }
		return selector ? selector(state) : state
	}) as never)

	return { resolveConflict }
}

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("ConflictBanner", () => {
	const conflictingFilePath = "/my/vault/notes/doc.md"
	const relativeConflictPath = "notes/doc.md"

	const conflictData = {
		localContent: "local text",
		remoteContent: "remote text",
		ancestorContent: "ancestor text",
	}

	describe("when no vault is open", () => {
		it("renders nothing", () => {
			setupMocks({ vault: null })
			const { container } = render(<ConflictBanner filePath={conflictingFilePath} />)
			expect(container).toBeEmptyDOMElement()
		})
	})

	describe("when no conflict exists for the file", () => {
		it("renders nothing", () => {
			setupMocks({ conflicts: {} })
			const { container } = render(<ConflictBanner filePath={conflictingFilePath} />)
			expect(container).toBeEmptyDOMElement()
		})
	})

	describe("when a conflict exists for the file", () => {
		beforeEach(() => {
			setupMocks({ conflicts: { [relativeConflictPath]: conflictData } })
		})

		it("renders conflict warning", () => {
			render(<ConflictBanner filePath={conflictingFilePath} />)
			expect(screen.getByText("Conflicting changes detected")).toBeInTheDocument()
		})

		it("shows Keep Local button", () => {
			render(<ConflictBanner filePath={conflictingFilePath} />)
			expect(screen.getByRole("button", { name: "Keep Local" })).toBeInTheDocument()
		})

		it("shows Keep Remote button", () => {
			render(<ConflictBanner filePath={conflictingFilePath} />)
			expect(screen.getByRole("button", { name: "Keep Remote" })).toBeInTheDocument()
		})

		it("shows View Diff button", () => {
			render(<ConflictBanner filePath={conflictingFilePath} />)
			expect(screen.getByRole("button", { name: "View Diff" })).toBeInTheDocument()
		})
	})

	describe("resolving conflicts", () => {
		it("calls resolveConflict with keep_local resolution", async () => {
			const { resolveConflict } = setupMocks({
				conflicts: { [relativeConflictPath]: conflictData },
			})
			render(<ConflictBanner filePath={conflictingFilePath} />)
			await userEvent.click(screen.getByRole("button", { name: "Keep Local" }))
			expect(resolveConflict).toHaveBeenCalledWith(relativeConflictPath, { type: "keep_local" })
		})

		it("calls resolveConflict with keep_remote resolution", async () => {
			const { resolveConflict } = setupMocks({
				conflicts: { [relativeConflictPath]: conflictData },
			})
			render(<ConflictBanner filePath={conflictingFilePath} />)
			await userEvent.click(screen.getByRole("button", { name: "Keep Remote" }))
			expect(resolveConflict).toHaveBeenCalledWith(relativeConflictPath, { type: "keep_remote" })
		})
	})

	describe("View Diff", () => {
		it("renders ConflictDiffView when View Diff is clicked", async () => {
			setupMocks({ conflicts: { [relativeConflictPath]: conflictData } })
			render(<ConflictBanner filePath={conflictingFilePath} />)
			await userEvent.click(screen.getByRole("button", { name: "View Diff" }))
			expect(screen.getByRole("button", { name: "Close Diff" })).toBeInTheDocument()
		})

		it("hides ConflictDiffView when closed", async () => {
			setupMocks({ conflicts: { [relativeConflictPath]: conflictData } })
			render(<ConflictBanner filePath={conflictingFilePath} />)
			await userEvent.click(screen.getByRole("button", { name: "View Diff" }))
			await userEvent.click(screen.getByRole("button", { name: "Close Diff" }))
			expect(screen.queryByRole("button", { name: "Close Diff" })).not.toBeInTheDocument()
		})
	})

	describe("path normalization", () => {
		it("matches conflict using relative path (strips vault prefix)", () => {
			setupMocks({ conflicts: { [relativeConflictPath]: conflictData } })
			render(<ConflictBanner filePath={conflictingFilePath} />)
			expect(screen.getByText("Conflicting changes detected")).toBeInTheDocument()
		})

		it("renders nothing when file is not in vault directory", () => {
			setupMocks({ conflicts: { [relativeConflictPath]: conflictData } })
			const { container } = render(<ConflictBanner filePath="/other/path/doc.md" />)
			expect(container).toBeEmptyDOMElement()
		})
	})
})
