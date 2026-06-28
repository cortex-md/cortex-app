import { beforeEach, describe, expect, it, vi } from "vitest"
import { setMarketplaceCallbacks, useMarketplaceStore } from "./marketplaceStore"
import type { RegistryEntry } from "./types"

const testState = vi.hoisted(() => ({
	installPlugin: vi.fn(),
	installTheme: vi.fn(),
	uninstallPlugin: vi.fn(),
	uninstallTheme: vi.fn(),
	notify: vi.fn(),
}))

vi.mock("./installService", () => ({
	installPlugin: testState.installPlugin,
	installTheme: testState.installTheme,
	uninstallPlugin: testState.uninstallPlugin,
	uninstallTheme: testState.uninstallTheme,
}))

vi.mock("@cortex/platform", () => ({
	getPlatform: () => ({
		app: {
			getCurrentAppVersion: vi.fn(async () => "0.1.0"),
			openExternalUrl: vi.fn(async () => undefined),
			resolveFileAssetUrl: vi.fn((path: string) => `asset://${path}`),
		},
	}),
}))

vi.mock("./registryService", () => ({
	fetchLatestRelease: vi.fn(),
	fetchManifestMinVersion: vi.fn(),
	fetchPluginRegistry: vi.fn(async () => []),
	fetchReadme: vi.fn(),
	fetchThemeRegistry: vi.fn(async () => []),
	invalidateRegistryCache: vi.fn(),
}))

vi.mock("./updateService", () => ({
	detectAvailableUpdates: vi.fn(async () => ({})),
}))

const entry: RegistryEntry = {
	id: "test-plugin",
	name: "Test Plugin",
	author: "Tester",
	description: "A plugin",
	coverImageUrl: "",
	repo: "owner/test-plugin",
}

beforeEach(() => {
	vi.clearAllMocks()
	useMarketplaceStore.setState({
		activeTab: "plugins",
		loadingEntryId: null,
		installError: null,
		availableUpdates: { "test-plugin": "1.1.0" },
	})
	setMarketplaceCallbacks({
		getPluginsDir: () => "/vault/.cortex/plugins",
		getThemesDir: () => "/vault/.cortex/themes",
		reloadPluginHost: vi.fn(),
		reloadThemes: vi.fn(),
		isPluginInstalled: () => false,
		isThemeInstalled: () => false,
		notify: testState.notify,
	})
})

describe("marketplaceStore installEntry", () => {
	it("stores install errors without rejecting", async () => {
		testState.installPlugin.mockRejectedValueOnce(new Error("download failed"))

		await expect(useMarketplaceStore.getState().installEntry(entry)).resolves.toBeUndefined()

		const state = useMarketplaceStore.getState()
		expect(state.installError).toBe("download failed")
		expect(state.loadingEntryId).toBeNull()
		expect(state.availableUpdates["test-plugin"]).toBe("1.1.0")
		expect(testState.notify).toHaveBeenCalledWith({
			action: "install",
			kind: "plugins",
			entryId: "test-plugin",
			title: "Install failed",
			body: "download failed",
			level: "error",
		})
	})

	it("notifies when an install succeeds", async () => {
		await useMarketplaceStore.getState().installEntry(entry)

		expect(testState.notify).toHaveBeenCalledWith({
			action: "install",
			kind: "plugins",
			entryId: "test-plugin",
			title: "Install complete",
			body: "Test Plugin",
			level: "success",
		})
	})

	it("notifies when an update succeeds", async () => {
		setMarketplaceCallbacks({
			getPluginsDir: () => "/vault/.cortex/plugins",
			getThemesDir: () => "/vault/.cortex/themes",
			reloadPluginHost: vi.fn(),
			reloadThemes: vi.fn(),
			isPluginInstalled: () => true,
			isThemeInstalled: () => false,
			notify: testState.notify,
		})

		await useMarketplaceStore.getState().installEntry(entry)

		expect(testState.notify).toHaveBeenCalledWith({
			action: "update",
			kind: "plugins",
			entryId: "test-plugin",
			title: "Update installed",
			body: "Test Plugin",
			level: "success",
		})
	})

	it("notifies when an uninstall succeeds", async () => {
		await useMarketplaceStore.getState().uninstallEntry(entry)

		expect(testState.notify).toHaveBeenCalledWith({
			action: "uninstall",
			kind: "plugins",
			entryId: "test-plugin",
			title: "Uninstall complete",
			body: "Test Plugin",
			level: "success",
		})
	})
})
