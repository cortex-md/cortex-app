import { useVaultStore, type VaultMetadata } from "@cortex/core"
import {
	type MarketplaceState,
	type RegistryEntry,
	setMarketplaceCallbacks,
	useMarketplaceStore,
} from "@cortex/marketplace"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MarketplaceSection } from "../../../features/marketplace/MarketplaceSection"

vi.mock("@cortex/editor/reading-view", () => ({
	ReadingView: ({ content }: { content: string }) => (
		<article data-testid="readme">{content}</article>
	),
}))

const vault: VaultMetadata = {
	uuid: "vault-id",
	path: "/vault",
	name: "Vault",
	fileCount: 8,
}

const installedPlugin: RegistryEntry = {
	id: "installed-toolkit",
	name: "Installed Toolkit",
	author: "Cortex Labs",
	description: "Utilities already installed in this vault.",
	coverImageUrl: "",
	repo: "cortex-md/installed-toolkit",
}

const syntaxPlugin: RegistryEntry = {
	id: "syntax-highlighter",
	name: "Syntax Highlighter",
	author: "Community",
	authorUrl: "community.example.com",
	description: "Readable language highlighting for dense code notes.",
	coverImageUrl: "",
	repo: "community/syntax-highlighter",
}

const themeEntry: RegistryEntry = {
	id: "calm-theme",
	name: "Calm Theme",
	author: "Themesmith",
	description: "A quiet reading theme for long sessions.",
	coverImageUrl: "",
	repo: "themesmith/calm-theme",
}

const originalActions = {
	setActiveTab: useMarketplaceStore.getState().setActiveTab,
	setSearchQuery: useMarketplaceStore.getState().setSearchQuery,
	setFilterInstalled: useMarketplaceStore.getState().setFilterInstalled,
	setSortOrder: useMarketplaceStore.getState().setSortOrder,
	selectEntry: useMarketplaceStore.getState().selectEntry,
	checkUpdates: useMarketplaceStore.getState().checkUpdates,
	loadManifestMetadata: useMarketplaceStore.getState().loadManifestMetadata,
	loadReleaseDates: useMarketplaceStore.getState().loadReleaseDates,
}

const loadRegistry = vi.fn().mockResolvedValue(undefined)
const refreshRegistry = vi.fn().mockResolvedValue(undefined)
const loadReadme = vi.fn().mockResolvedValue(undefined)
const loadManifestMetadata = vi.fn().mockResolvedValue(undefined)
const installEntry = vi.fn().mockResolvedValue(undefined)
const uninstallEntry = vi.fn().mockResolvedValue(undefined)

function configureMarketplaceState(overrides: Partial<MarketplaceState> = {}) {
	useMarketplaceStore.setState({
		pluginEntries: [installedPlugin, syntaxPlugin],
		themeEntries: [themeEntry],
		activeTab: "plugins",
		searchQuery: "",
		filterInstalled: false,
		sortOrder: "default",
		selectedEntryId: null,
		loadingEntryId: null,
		installError: null,
		registryError: null,
		readmeCache: {
			"syntax-highlighter": "# Syntax Highlighter",
		},
		readmeLoading: false,
		appVersion: "1.0.0",
		minVersionCache: {},
		manifestMetadataCache: {
			"installed-toolkit": {
				version: "2.0.0",
				minAppVersion: "0.7.0",
				capabilities: ["commands", "settings"],
			},
			"syntax-highlighter": {
				version: "0.9.1",
				minAppVersion: "0.5.0",
				capabilities: ["editor:read", "editor:write", "workspace:tabs"],
			},
			"calm-theme": {
				version: "1.1.0",
				minAppVersion: "0.4.0",
				capabilities: [],
			},
		},
		manifestMetadataLoading: {},
		availableUpdates: {
			"installed-toolkit": "2.0.0",
		},
		updatesChecking: false,
		updatesChecked: true,
		releaseDates: {
			"installed-toolkit": "2026-06-01T00:00:00Z",
			"syntax-highlighter": "2026-06-10T00:00:00Z",
			"calm-theme": "2026-06-05T00:00:00Z",
		},
		releaseDatesLoading: false,
		...originalActions,
		loadRegistry,
		refreshRegistry,
		loadReadme,
		loadManifestMetadata,
		installEntry,
		uninstallEntry,
		...overrides,
	})
}

function configureInstalledEntries(pluginIds = ["installed-toolkit"], themeIds: string[] = []) {
	setMarketplaceCallbacks({
		getPluginsDir: () => "/vault/.cortex/plugins",
		getThemesDir: () => "/vault/.cortex/themes",
		reloadPluginHost: vi.fn().mockResolvedValue(undefined),
		reloadThemes: vi.fn().mockResolvedValue(undefined),
		isPluginInstalled: (id) => pluginIds.includes(id),
		isThemeInstalled: (id) => themeIds.includes(id),
	})
}

function clickCatalogRow(name: string) {
	const row = screen.getByText(name).closest("button")
	if (!row) throw new Error(`Missing catalog row for ${name}`)
	return userEvent.click(row)
}

beforeEach(() => {
	useVaultStore.setState({ vault })
	configureInstalledEntries()
	configureMarketplaceState()
})

afterEach(() => {
	cleanup()
	configureInstalledEntries([])
	vi.clearAllMocks()
})

describe("MarketplaceSection", () => {
	it("keeps the detail pane hidden until an item is selected", () => {
		render(<MarketplaceSection initialTab="plugins" />)

		expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument()
		expect(
			screen.queryByText("Select a plugin to view details and README."),
		).not.toBeInTheDocument()
	})

	it("filters catalog rows by search", async () => {
		render(<MarketplaceSection initialTab="plugins" />)

		await userEvent.type(screen.getByPlaceholderText("Search plugins..."), "syntax")

		expect(screen.getByText("Syntax Highlighter")).toBeInTheDocument()
		expect(screen.queryByText("Installed Toolkit")).not.toBeInTheDocument()
	})

	it("filters catalog rows to installed entries", async () => {
		render(<MarketplaceSection initialTab="plugins" />)

		await userEvent.click(screen.getByRole("button", { name: "Installed" }))

		expect(screen.getByText("Installed Toolkit")).toBeInTheDocument()
		expect(screen.queryByText("Syntax Highlighter")).not.toBeInTheDocument()
	})

	it("switches tabs and reports workspace view state changes", async () => {
		const onTabChange = vi.fn()

		render(<MarketplaceSection initialTab="plugins" onTabChange={onTabChange} />)

		await userEvent.click(screen.getByRole("tab", { name: "Themes" }))

		expect(onTabChange).toHaveBeenCalledWith("themes")
		expect(screen.getByText("Calm Theme")).toBeInTheDocument()
	})

	it("selects an item and renders cached README content", async () => {
		render(<MarketplaceSection initialTab="plugins" />)

		await clickCatalogRow("Syntax Highlighter")

		expect(screen.getByRole("heading", { name: "Syntax Highlighter" })).toBeInTheDocument()
		expect(screen.getByTestId("readme")).toHaveTextContent("# Syntax Highlighter")
		expect(loadReadme).toHaveBeenCalledWith(syntaxPlugin)
		expect(loadManifestMetadata).toHaveBeenCalledWith(syntaxPlugin)
	})

	it("opens with a directly selected Marketplace entry", () => {
		render(<MarketplaceSection initialTab="plugins" initialSelectedEntryId="syntax-highlighter" />)

		expect(screen.getByRole("heading", { name: "Syntax Highlighter" })).toBeInTheDocument()
		expect(loadReadme).toHaveBeenCalledWith(syntaxPlugin)
		expect(loadManifestMetadata).toHaveBeenCalledWith(syntaxPlugin)
	})

	it("shows plugin manifest metadata in the detail pane", async () => {
		render(<MarketplaceSection initialTab="plugins" />)

		await clickCatalogRow("Syntax Highlighter")

		expect(screen.getByText("Plugin version")).toBeInTheDocument()
		expect(screen.getByText("0.9.1")).toBeInTheDocument()
		expect(screen.getByText("Minimum Cortex")).toBeInTheDocument()
		expect(screen.getByText("0.5.0")).toBeInTheDocument()
		expect(screen.getByText("Source")).toBeInTheDocument()
		expect(screen.getByText("Community")).toBeInTheDocument()
		expect(screen.getByText("community/syntax-highlighter")).toBeInTheDocument()
	})

	it("shows plugin capabilities as readable permissions after expanding them", async () => {
		render(<MarketplaceSection initialTab="plugins" />)

		await clickCatalogRow("Syntax Highlighter")
		await userEvent.click(screen.getByRole("button", { name: /Capabilities/ }))

		expect(screen.getByText("Read active editor")).toBeInTheDocument()
		expect(screen.getByText("Write editor content")).toBeInTheDocument()
		expect(screen.getByText("Open workspace tabs")).toBeInTheDocument()
	})

	it("keeps compatibility warnings based on the manifest minimum app version", async () => {
		configureMarketplaceState({
			appVersion: "0.1.0",
			manifestMetadataCache: {
				"syntax-highlighter": {
					version: "0.9.1",
					minAppVersion: "2.0.0",
					capabilities: [],
				},
			},
		})

		render(<MarketplaceSection initialTab="plugins" />)

		await clickCatalogRow("Syntax Highlighter")

		expect(
			screen.getByText("This plugin requires Cortex v2.0.0 or later. You are running v0.1.0."),
		).toBeInTheDocument()
	})

	it("shows update actions and dispatches update installs", async () => {
		render(<MarketplaceSection initialTab="plugins" />)

		await clickCatalogRow("Installed Toolkit")
		await userEvent.click(screen.getByRole("button", { name: "Update to 2.0.0" }))

		expect(screen.getByText("Update available")).toBeInTheDocument()
		expect(screen.getByText("No README available.")).toBeInTheDocument()
		expect(installEntry).toHaveBeenCalledWith(installedPlugin)
	})

	it("dispatches install actions for uninstalled entries", async () => {
		render(<MarketplaceSection initialTab="plugins" />)

		await clickCatalogRow("Syntax Highlighter")
		await userEvent.click(screen.getByRole("button", { name: "Install" }))

		expect(installEntry).toHaveBeenCalledWith(syntaxPlugin)
	})

	it("disables installation when no vault is open", async () => {
		useVaultStore.setState({ vault: null })

		render(<MarketplaceSection initialTab="plugins" />)

		await clickCatalogRow("Syntax Highlighter")

		expect(screen.getByRole("button", { name: "Open a vault to install" })).toBeDisabled()
	})

	it("shows registry errors with retry", async () => {
		configureMarketplaceState({
			pluginEntries: [],
			themeEntries: [],
			registryError: "network unavailable",
		})

		render(<MarketplaceSection initialTab="plugins" />)

		expect(screen.getByText("Failed to load registry.")).toBeInTheDocument()
		await userEvent.click(screen.getByRole("button", { name: "Retry" }))
		expect(refreshRegistry).toHaveBeenCalled()
	})

	it("shows an empty registry state after loading completes", async () => {
		configureMarketplaceState({
			pluginEntries: [],
			themeEntries: [],
			availableUpdates: {},
		})

		render(<MarketplaceSection initialTab="plugins" />)

		expect(await screen.findByText("No plugins are available yet.")).toBeInTheDocument()
	})
})
