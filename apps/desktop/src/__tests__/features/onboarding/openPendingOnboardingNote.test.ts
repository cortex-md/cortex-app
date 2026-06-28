import { afterEach, describe, expect, it, vi } from "vitest"

let pendingOnboardingNotePath: string | null = "/vault/Welcome to Cortex.md"
const clearPendingOnboardingNotePath = vi.fn(() => {
	pendingOnboardingNotePath = null
})
const openTab = vi.fn()

vi.mock("@cortex/core", () => ({
	useVaultStore: {
		getState: () => ({
			clearPendingOnboardingNotePath,
			pendingOnboardingNotePath,
		}),
	},
	useWorkspaceStore: {
		getState: () => ({
			openTab,
		}),
	},
}))

import { openPendingOnboardingNote } from "../../../features/onboarding/openPendingOnboardingNote"

afterEach(() => {
	pendingOnboardingNotePath = "/vault/Welcome to Cortex.md"
	vi.clearAllMocks()
})

describe("openPendingOnboardingNote", () => {
	it("opens and clears the pending onboarding note", () => {
		openPendingOnboardingNote()

		expect(openTab).toHaveBeenCalledWith("/vault/Welcome to Cortex.md")
		expect(clearPendingOnboardingNotePath).toHaveBeenCalled()
	})

	it("does nothing when there is no pending note", () => {
		pendingOnboardingNotePath = null

		openPendingOnboardingNote()

		expect(openTab).not.toHaveBeenCalled()
		expect(clearPendingOnboardingNotePath).not.toHaveBeenCalled()
	})
})
