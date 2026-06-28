import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const toggleExcludedPath = vi.fn()

vi.mock("@cortex/core", () => ({
	isSyncImagePath: () => false,
	shouldIgnoreSyncPath: () => false,
	useSyncStore: (selector: (state: unknown) => unknown) =>
		selector({
			syncPreferences: {
				syncSettings: false,
				syncHotkeys: false,
				syncWorkspace: false,
				syncPluginMetadata: false,
				syncThemeMetadata: false,
				syncBookmarks: false,
				ignoreImages: false,
				excludedPaths: ["Private/"],
			},
			toggleExcludedPath,
		}),
	useVaultStore: (selector: (state: unknown) => unknown) =>
		selector({
			vault: { path: "/vault" },
			files: [
				{
					path: "/vault/Notes/",
					name: "Notes",
					isDir: true,
					size: 0,
					mtime: 0,
				},
			],
		}),
}))

import { ExcludedPathsSettings } from "../../../features/settings/ExcludedPathsSettings"

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("ExcludedPathsSettings", () => {
	it("removes excluded paths with the shared button pattern", async () => {
		render(<ExcludedPathsSettings />)

		await userEvent.click(screen.getByRole("button", { name: "Remove Private/" }))

		expect(toggleExcludedPath).toHaveBeenCalledWith("Private/", false)
	})

	it("adds custom patterns through the shared picker", async () => {
		render(<ExcludedPathsSettings />)
		const input = screen.getByRole("combobox", {
			name: "Search files, folders, or add a pattern...",
		})

		await userEvent.type(input, "*.log")
		await userEvent.keyboard("{Enter}")

		expect(toggleExcludedPath).toHaveBeenCalledWith("*.log", true)
	})

	it("reserves space for options inside the clipped settings group", async () => {
		render(<ExcludedPathsSettings />)
		const input = screen.getByRole("combobox", {
			name: "Search files, folders, or add a pattern...",
		})

		await userEvent.click(input)

		expect(input.parentElement).toHaveClass("pb-64")
		expect(screen.getByRole("button", { name: "Notes/" })).toBeInTheDocument()
	})
})
