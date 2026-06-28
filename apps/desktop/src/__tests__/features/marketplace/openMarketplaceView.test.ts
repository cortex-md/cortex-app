import { useVaultStore, useWorkspaceStore, type VaultMetadata } from "@cortex/core"
import { useMarketplaceStore } from "@cortex/marketplace"
import { beforeEach, describe, expect, it } from "vitest"
import { MarketplaceView } from "../../../features/marketplace/MarketplaceView"
import { MARKETPLACE_VIEW_ID } from "../../../features/marketplace/marketplaceWorkspaceView"
import { openMarketplaceView } from "../../../features/marketplace/openMarketplaceView"
import { getCoreViewComponent } from "../../../features/split-view/coreViewRegistry"

const ROOT_PANE_ID = "root"

const vault: VaultMetadata = {
	uuid: "vault-id",
	path: "/vault",
	name: "Vault",
	fileCount: 12,
}

function buildInitialWorkspace() {
	return {
		panes: {
			[ROOT_PANE_ID]: { id: ROOT_PANE_ID, tabs: [], activeTabId: null },
		},
		splitTree: { type: "leaf" as const, id: ROOT_PANE_ID },
		activePaneId: ROOT_PANE_ID,
		mruOrder: [],
		recentlyClosed: [],
	}
}

beforeEach(() => {
	useWorkspaceStore.setState(buildInitialWorkspace())
	useVaultStore.setState({ vault })
	useMarketplaceStore.setState({
		activeTab: "plugins",
		selectedEntryId: null,
		searchQuery: "",
		filterInstalled: false,
		sortOrder: "default",
	})
})

describe("openMarketplaceView", () => {
	it("creates a persistent Marketplace workspace tab", () => {
		expect(openMarketplaceView("themes")).toBe(true)

		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		const tab = pane.tabs[0]

		expect(tab).toMatchObject({
			tabType: "view",
			viewId: MARKETPLACE_VIEW_ID,
			title: "Marketplace",
			viewState: { tab: "themes" },
			isEphemeral: false,
		})
		expect(pane.activeTabId).toBe(tab.id)
		expect(useMarketplaceStore.getState().activeTab).toBe("themes")
	})

	it("reuses and activates an existing Marketplace tab", () => {
		openMarketplaceView("plugins")
		const firstTab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]

		openMarketplaceView("themes")

		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs).toHaveLength(1)
		expect(pane.tabs[0].id).toBe(firstTab.id)
		expect(pane.tabs[0].viewState).toEqual({ tab: "themes" })
		expect(pane.activeTabId).toBe(firstTab.id)
	})

	it("opens Marketplace with a selected catalog entry", () => {
		expect(openMarketplaceView("plugins", { selectedEntryId: "syntax-highlighter" })).toBe(true)

		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs[0].viewState).toEqual({
			tab: "plugins",
			selectedEntryId: "syntax-highlighter",
		})
		expect(useMarketplaceStore.getState().selectedEntryId).toBe("syntax-highlighter")
	})

	it("does not open without a vault", () => {
		useVaultStore.setState({ vault: null })

		expect(openMarketplaceView("plugins")).toBe(false)
		expect(useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs).toHaveLength(0)
	})

	it("registers Marketplace as a core view", () => {
		expect(getCoreViewComponent(MARKETPLACE_VIEW_ID)).toBe(MarketplaceView)
	})
})
