import { getPlatform } from "@cortex/platform"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	SYNC_WELCOME_MARKDOWN,
	SYNC_WELCOME_TITLE,
	SYNC_WELCOME_VIEW_ID,
} from "../../features/sync/syncWelcome"
import {
	isSyncCheckoutCompleteDeepLink,
	useSyncBillingDeepLink,
} from "../../hooks/useSyncBillingDeepLink"

vi.mock("@cortex/core", () => ({
	DEFAULT_CLOUD_SYNC_SERVER_URL: "https://sync.example.com",
	useSubscriptionStore: vi.fn(),
	useVaultStore: vi.fn(),
	useWorkspaceStore: vi.fn(),
}))

import { useSubscriptionStore, useVaultStore, useWorkspaceStore } from "@cortex/core"

const mockVault = { path: "/vault", name: "Test", uuid: "vault-id" }
const onDeepLinkOpen = vi.fn()
const refreshStatus = vi.fn()
const clearBlock = vi.fn()
const openViewTab = vi.fn()
const unlisten = vi.fn()

let deepLinkListener: ((urls: string[]) => void) | null = null

function activeStatus(entitled: boolean) {
	return {
		status: entitled ? "active" : "none",
		entitled,
		currentPeriodStart: null,
		currentPeriodEnd: null,
		entitlementExpiresAt: null,
		billingCycle: entitled ? "MONTHLY" : null,
		planProductId: entitled ? "price_test" : null,
	}
}

function setupStores(options: { entitled?: boolean; vault?: typeof mockVault | null } = {}) {
	const vault = options.vault === undefined ? mockVault : options.vault
	refreshStatus.mockResolvedValue(activeStatus(options.entitled ?? true))

	vi.mocked(getPlatform).mockReturnValue({
		app: {
			onDeepLinkOpen,
		},
	} as never)

	vi.mocked(useVaultStore).mockImplementation(((
		selector?: (state: { vault: unknown }) => unknown,
	) => {
		const state = { vault }
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useWorkspaceStore).mockImplementation(((
		selector?: (state: { openViewTab: typeof openViewTab }) => unknown,
	) => {
		const state = { openViewTab }
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useSubscriptionStore).mockImplementation(((
		selector?: (state: {
			refreshStatus: typeof refreshStatus
			clearBlock: typeof clearBlock
		}) => unknown,
	) => {
		const state = { refreshStatus, clearBlock }
		return selector ? selector(state) : state
	}) as never)
}

beforeEach(() => {
	deepLinkListener = null
	onDeepLinkOpen.mockImplementation(async (listener: (urls: string[]) => void) => {
		deepLinkListener = listener
		return unlisten
	})
	setupStores()
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("isSyncCheckoutCompleteDeepLink", () => {
	it("accepts only the sync checkout completion route", () => {
		expect(isSyncCheckoutCompleteDeepLink("cortex://sync/checkout-complete")).toBe(true)
		expect(isSyncCheckoutCompleteDeepLink("cortex://sync/checkout-complete?source=site")).toBe(true)
		expect(isSyncCheckoutCompleteDeepLink("cortex://sync/welcome")).toBe(false)
		expect(isSyncCheckoutCompleteDeepLink("https://sync.example.com/checkout-complete")).toBe(false)
		expect(isSyncCheckoutCompleteDeepLink("not a url")).toBe(false)
	})
})

describe("useSyncBillingDeepLink", () => {
	it("refreshes cloud status and opens the ephemeral welcome note after entitlement", async () => {
		renderHook(() => useSyncBillingDeepLink())
		await waitFor(() => expect(onDeepLinkOpen).toHaveBeenCalled())

		act(() => {
			deepLinkListener?.(["cortex://sync/checkout-complete?ignored=true"])
		})

		await waitFor(() =>
			expect(refreshStatus).toHaveBeenCalledWith("https://sync.example.com", { force: true }),
		)
		expect(clearBlock).toHaveBeenCalled()
		expect(openViewTab).toHaveBeenCalledWith(SYNC_WELCOME_VIEW_ID, SYNC_WELCOME_TITLE, {
			ephemeral: true,
			viewState: {
				content: SYNC_WELCOME_MARKDOWN,
			},
		})
	})

	it("does not open the welcome note when the refreshed status is not entitled", async () => {
		setupStores({ entitled: false })
		renderHook(() => useSyncBillingDeepLink())
		await waitFor(() => expect(onDeepLinkOpen).toHaveBeenCalled())

		act(() => {
			deepLinkListener?.(["cortex://sync/checkout-complete"])
		})

		await waitFor(() => expect(refreshStatus).toHaveBeenCalled())
		expect(clearBlock).not.toHaveBeenCalled()
		expect(openViewTab).not.toHaveBeenCalled()
	})

	it("ignores malformed and unrelated deep links", async () => {
		renderHook(() => useSyncBillingDeepLink())
		await waitFor(() => expect(onDeepLinkOpen).toHaveBeenCalled())

		act(() => {
			deepLinkListener?.(["not a url", "cortex://sync/welcome"])
		})

		expect(refreshStatus).not.toHaveBeenCalled()
		expect(openViewTab).not.toHaveBeenCalled()
	})

	it("refreshes and clears the block without opening a tab when no vault is active", async () => {
		setupStores({ vault: null })
		renderHook(() => useSyncBillingDeepLink())
		await waitFor(() => expect(onDeepLinkOpen).toHaveBeenCalled())

		act(() => {
			deepLinkListener?.(["cortex://sync/checkout-complete"])
		})

		await waitFor(() => expect(refreshStatus).toHaveBeenCalled())
		expect(clearBlock).toHaveBeenCalled()
		expect(openViewTab).not.toHaveBeenCalled()
	})

	it("opens at most one welcome note per app session", async () => {
		renderHook(() => useSyncBillingDeepLink())
		await waitFor(() => expect(onDeepLinkOpen).toHaveBeenCalled())

		act(() => {
			deepLinkListener?.(["cortex://sync/checkout-complete"])
		})
		await waitFor(() => expect(openViewTab).toHaveBeenCalledTimes(1))

		act(() => {
			deepLinkListener?.(["cortex://sync/checkout-complete"])
		})

		await waitFor(() => expect(refreshStatus).toHaveBeenCalledTimes(2))
		expect(openViewTab).toHaveBeenCalledTimes(1)
	})
})
