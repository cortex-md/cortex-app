import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const appUpdateMocks = vi.hoisted(() => ({
	checkForAppUpdate: vi.fn(),
	installPendingAppUpdate: vi.fn(),
	refreshAppUpdateStatus: vi.fn(),
	useAppUpdateSnapshot: vi.fn(),
}))
const openMarketplaceView = vi.hoisted(() => vi.fn())
const runInMainWindow = vi.hoisted(() => vi.fn())
const pluginHostMocks = vi.hoisted(() => ({
	disablePlugin: vi.fn().mockResolvedValue(undefined),
	enablePlugin: vi.fn().mockResolvedValue(undefined),
	getCommunityPluginsDir: vi.fn(() => "/vault/.cortex/plugins"),
	saveEnabledPlugins: vi.fn().mockResolvedValue(undefined),
	setPluginSetting: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@cortex/core", () => ({
	SELF_HOSTED_ENVIRONMENT_GROUPS: [],
	useTemplateStore: vi.fn((selector: (state: { templates: [] }) => unknown) =>
		selector({ templates: [] }),
	),
	noteCache: {
		flushAll: vi.fn().mockResolvedValue(undefined),
	},
	useAccountStore: vi.fn((selector: (state: { profile: null }) => unknown) =>
		selector({ profile: null }),
	),
	useAuthStore: vi.fn(),
	useEditorStore: vi.fn(() => ({
		flushActive: vi.fn().mockResolvedValue(undefined),
	})),
	useUIStore: vi.fn(),
	useVaultStore: vi.fn(),
}))

vi.mock("../../../features/app-updates/appUpdateStore", () => appUpdateMocks)

vi.mock("../../../features/marketplace/openMarketplaceView", () => ({
	openMarketplaceView,
}))

vi.mock("../../../bootstrap/pluginHost", () => ({ pluginHost: pluginHostMocks }))

vi.mock("../../../windows/runInMainWindow", () => ({ runInMainWindow }))

vi.mock("../../../features/settings/coreSettingsPageRegistry", () => ({
	get CORE_SETTINGS_PAGES() {
		return coreSettingsPages
	},
}))

vi.mock("../../../features/settings/desktopSettingsControls", () => ({
	desktopSettingsControls: testSettingsControls,
}))

vi.mock("@cortex/plugin-host-core", async (importOriginal) => ({
	...(await importOriginal<typeof import("@cortex/plugin-host-core")>()),
	usePluginStore: vi.fn(),
}))

import { useAuthStore, useUIStore, useVaultStore } from "@cortex/core"
import { type RegisteredSettingsPage, usePluginStore } from "@cortex/plugin-host-core"
import { type EditorSettings, type GeneralSettings, useSettingsStore } from "@cortex/settings"
import type { ComponentProps } from "react"
import type { SettingsControlComponents } from "../../../features/plugins/rendering/PluginSettingsRenderer"
import { EditorSection } from "../../../features/settings/EditorSettings"
import { GeneralSection } from "../../../features/settings/GeneralSettings"
import { PluginsSection } from "../../../features/settings/PluginsSettings"
import {
	SettingsField,
	SettingsGroup,
	SettingsPage,
	SettingsSection,
} from "../../../features/settings/SettingsPrimitives"
import { SettingsView } from "../../../features/settings/SettingsView"

const onUpdate = vi.fn()
const openAuth = vi.fn()
const logout = vi.fn().mockResolvedValue(undefined)

const generalSettings: GeneralSettings = {
	autoOpenLastVault: true,
}

const idleUpdateStatus = {
	state: "idle",
	currentVersion: "0.1.0",
	pendingUpdate: null,
	lastCheckedAt: null,
	lastError: null,
	downloaded: 0,
	contentLength: null,
}

const editorSettings: EditorSettings = {
	tabSize: 4,
	useSpaces: false,
	wordWrap: true,
	folding: true,
	showLineNumbers: true,
	vimMode: false,
	slashCommands: true,
	markdownToolbar: false,
	autoSave: true,
	autoSaveInterval: 2,
	imageStorageLocation: "same",
	imageStorageCustomPath: "",
}

const testSettingsControls: SettingsControlComponents = vi.hoisted(() => ({
	Group: ({ children }) => <div>{children}</div>,
	Field: ({ label, description, children }) => (
		<div>
			<span>{label}</span>
			{description && <small>{description}</small>}
			{children}
		</div>
	),
	Switch: ({ checked, onCheckedChange }) => (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={() => onCheckedChange(!checked)}
		>
			Toggle
		</button>
	),
	TextInput: ({ value, onChange }) => (
		<input value={value} onChange={(event) => onChange(event.target.value)} />
	),
	NumberInput: ({ value, onChange }) => (
		<input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
	),
	Select: ({ value, onChange, options }) => (
		<select value={value} onChange={(event) => onChange(event.target.value)}>
			{options.map((option) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	),
	Slider: ({ value, onChange }) => (
		<button type="button" onClick={() => onChange(8)}>
			Task limit {value}
		</button>
	),
	ColorPicker: ({ value, onChange }) => (
		<input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
	),
	Label: ({ children }) => <span>{children}</span>,
	Description: ({ children }) => <p>{children}</p>,
}))

function corePage(
	id: string,
	title: string,
	component: RegisteredSettingsPage["component"],
): RegisteredSettingsPage {
	return {
		owner: "core",
		key: id,
		id,
		label: title,
		title,
		description: "",
		group: "Cortex",
		icon: "settings",
		component,
	}
}

const coreSettingsPages = [
	corePage("general", "General", () => null),
	corePage(
		"plugins",
		"Plugins",
		({
			onOpenMarketplace,
		}: {
			onOpenMarketplace: ComponentProps<typeof PluginsSection>["onBrowseMarketplace"]
		}) => <PluginsSection onBrowseMarketplace={onOpenMarketplace} />,
	),
]

function setupCoreStores({ authenticated = false }: { authenticated?: boolean } = {}) {
	vi.mocked(useUIStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = { openAuth }
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useAuthStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = {
			authenticated,
			user: authenticated
				? {
						userId: "user-id",
						email: "jane.doe@example.com",
						displayName: "Jane Doe",
					}
				: null,
			logout,
			serverUrl: "https://sync.example.com",
		}
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useVaultStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = {
			vault: { path: "/vault", name: "Vault", uuid: "vault-id" },
			refreshFiles: async () => {},
			files: [],
			recentVaults: [],
			openVault: vi.fn(),
			closeVault: vi.fn(),
			removeRecentVault: vi.fn(),
		}
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(usePluginStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = {
			plugins: {},
			settingsPages: [],
			settingsValues: {},
		}
		return selector ? selector(state) : state
	}) as never)
}

beforeEach(() => {
	appUpdateMocks.useAppUpdateSnapshot.mockReturnValue(idleUpdateStatus)
	useSettingsStore.setState((state) => ({
		settings: { ...state.settings, plugins: { allowCommunity: true } },
	}))
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("settings sections", () => {
	it("renders General settings with shared blocks and fields", () => {
		setupCoreStores()
		render(<GeneralSection settings={generalSettings} onUpdate={onUpdate} />)

		expect(screen.getByText("Startup")).toBeInTheDocument()
		expect(screen.getByText("Account")).toBeInTheDocument()
		expect(screen.getByText("No account connected")).toBeInTheDocument()
		expect(screen.getByRole("switch", { name: "Open last vault on startup" })).toBeInTheDocument()
		expect(screen.getByText("Updates")).toBeInTheDocument()
		expect(screen.getByText("Not checked yet")).toBeInTheDocument()
		expect(screen.getByText("Vaults")).toBeInTheDocument()
		expect(screen.getByText("No recent vaults")).toBeInTheDocument()
	})

	it("checks for updates from General settings", async () => {
		setupCoreStores()
		render(<GeneralSection settings={generalSettings} onUpdate={onUpdate} />)

		await userEvent.click(screen.getByRole("button", { name: "Check for updates" }))

		expect(appUpdateMocks.checkForAppUpdate).toHaveBeenCalledWith("manual")
	})

	it("shows the no update state in General settings", () => {
		appUpdateMocks.useAppUpdateSnapshot.mockReturnValue({
			...idleUpdateStatus,
			state: "up-to-date",
			lastCheckedAt: "2026-06-21T00:00:00Z",
		})
		setupCoreStores()
		render(<GeneralSection settings={generalSettings} onUpdate={onUpdate} />)

		expect(screen.getByText("Cortex is up to date")).toBeInTheDocument()
		expect(screen.getByText(/Last checked/)).toBeInTheDocument()
	})

	it("shows an available update action in General settings", async () => {
		appUpdateMocks.useAppUpdateSnapshot.mockReturnValue({
			...idleUpdateStatus,
			state: "available",
			pendingUpdate: {
				version: "0.1.1",
				currentVersion: "0.1.0",
				body: null,
				date: null,
				target: "darwin-aarch64",
			},
		})
		setupCoreStores()
		render(<GeneralSection settings={generalSettings} onUpdate={onUpdate} />)

		expect(screen.getByText("Update available")).toBeInTheDocument()
		await userEvent.click(screen.getByRole("button", { name: /Install/ }))

		expect(appUpdateMocks.installPendingAppUpdate).toHaveBeenCalled()
	})

	it("shows update install progress in General settings", () => {
		appUpdateMocks.useAppUpdateSnapshot.mockReturnValue({
			...idleUpdateStatus,
			state: "installing",
			downloaded: 512,
			contentLength: 1024,
		})
		setupCoreStores()
		render(<GeneralSection settings={generalSettings} onUpdate={onUpdate} />)

		expect(screen.getByText("Installing update")).toBeInTheDocument()
		expect(screen.getByText("512 B of 1.0 KB")).toBeInTheDocument()
	})

	it("shows update errors in General settings", () => {
		appUpdateMocks.useAppUpdateSnapshot.mockReturnValue({
			...idleUpdateStatus,
			state: "error",
			lastError: "network unavailable",
		})
		setupCoreStores()
		render(<GeneralSection settings={generalSettings} onUpdate={onUpdate} />)

		expect(screen.getByText("Update check failed")).toBeInTheDocument()
		expect(screen.getByText("network unavailable")).toBeInTheDocument()
	})

	it("shows the connected account and signs out from General settings", async () => {
		setupCoreStores({ authenticated: true })
		render(<GeneralSection settings={generalSettings} onUpdate={onUpdate} />)

		expect(screen.getByText("Jane Doe")).toBeInTheDocument()
		expect(screen.getByText("jane.doe@example.com")).toBeInTheDocument()
		expect(screen.getByText("JD")).toBeInTheDocument()
		expect(screen.getByText("Connected to sync.example.com")).toBeInTheDocument()

		await userEvent.click(screen.getByRole("button", { name: "Sign out" }))

		expect(logout).toHaveBeenCalledWith(false, "https://sync.example.com")
	})

	it("opens the account modal from General settings", async () => {
		setupCoreStores()
		render(<GeneralSection settings={generalSettings} onUpdate={onUpdate} />)

		await userEvent.click(screen.getByRole("button", { name: "Sign in" }))

		expect(openAuth).toHaveBeenCalledWith("login", "general")
	})

	it("renders Editor settings with standardized form labels", () => {
		render(<EditorSection settings={editorSettings} onUpdate={onUpdate} />)

		expect(screen.getByText("Indentation")).toBeInTheDocument()
		expect(screen.getByLabelText("Tab size")).toBeInTheDocument()
		expect(screen.getByRole("switch", { name: "Use spaces instead of tabs" })).toBeInTheDocument()
		expect(screen.getByText("Editor behavior")).toBeInTheDocument()
		expect(screen.getByRole("switch", { name: "Slash commands" })).toBeInTheDocument()
		expect(screen.getByRole("switch", { name: "Formatting toolbar" })).toBeInTheDocument()
		expect(screen.getByRole("switch", { name: "Vim mode" })).toBeInTheDocument()
		expect(screen.getByText("Images")).toBeInTheDocument()
	})

	it("updates the formatting toolbar setting", async () => {
		render(<EditorSection settings={editorSettings} onUpdate={onUpdate} />)

		await userEvent.click(screen.getByRole("switch", { name: "Formatting toolbar" }))

		expect(onUpdate).toHaveBeenCalledWith("editor", "markdownToolbar", true)
	})

	it("renders Plugins settings in shared lists", () => {
		setupCoreStores()
		vi.mocked(usePluginStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
			const state = {
				plugins: {
					core: {
						status: "enabled",
						community: false,
						manifest: {
							id: "core",
							name: "Core plugin",
							version: "1.0.0",
							author: "Cortex",
							description: "Built in",
							icon: "Blocks",
						},
					},
					community: {
						status: "disabled",
						community: true,
						manifest: {
							id: "community",
							name: "Community plugin",
							version: "1.0.0",
							author: "Community",
							description: "Installed locally",
							icon: "Blocks",
						},
					},
				},
			}
			return selector ? selector(state) : state
		}) as never)

		render(<PluginsSection onBrowseMarketplace={openMarketplaceView} />)

		expect(screen.getByText("Core plugins")).toBeInTheDocument()
		expect(screen.getByText("Community plugins")).toBeInTheDocument()
		expect(screen.getByText("Core plugin")).toBeInTheDocument()
		expect(screen.getByText("Community plugin")).toBeInTheDocument()
	})

	it("opens the workspace Marketplace from Plugins settings", async () => {
		setupCoreStores()

		render(<PluginsSection onBrowseMarketplace={openMarketplaceView} />)

		await userEvent.click(screen.getByRole("button", { name: "Browse" }))

		expect(openMarketplaceView).toHaveBeenCalledWith("plugins")
	})

	it("opens a community plugin directly in Marketplace", async () => {
		setupCoreStores()
		vi.mocked(usePluginStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
			const state = {
				plugins: {
					community: {
						status: "disabled",
						community: true,
						manifest: {
							id: "community",
							name: "Community plugin",
							version: "1.0.0",
							author: "Community",
							description: "Installed locally",
							icon: "Blocks",
						},
					},
				},
			}
			return selector ? selector(state) : state
		}) as never)

		render(<PluginsSection onBrowseMarketplace={openMarketplaceView} />)

		await userEvent.click(
			screen.getByRole("button", { name: "Open Community plugin in Marketplace" }),
		)

		expect(openMarketplaceView).toHaveBeenCalledWith("plugins", {
			selectedEntryId: "community",
		})
	})

	it("renders plugin slider settings from the store and persists through the plugin host", async () => {
		setupCoreStores()
		vi.mocked(usePluginStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
			const state = {
				plugins: {},
				settingsPages: [
					{
						owner: "note-pulse",
						key: "note-pulse:settings",
						id: "settings",
						label: "Note Pulse",
						title: "Note Pulse",
						description: "Configure this plugin for the current vault.",
						group: "Plugin settings",
						icon: "activity",
						schema: {
							reportTaskLimit: {
								label: "Task limit",
								description: "Maximum number of open tasks included in generated reports.",
								type: "slider",
								default: 5,
								min: 1,
								max: 10,
								step: 1,
							},
						},
					},
				],
				settingsValues: { "note-pulse": { reportTaskLimit: 3 } },
			}
			return selector ? selector(state) : state
		}) as never)

		render(
			<SettingsView
				target={{ section: "note-pulse:settings", focus: false, nonce: 0 }}
				onNavigate={vi.fn()}
				onOpenMarketplace={openMarketplaceView}
			/>,
		)

		await userEvent.click(screen.getByRole("button", { name: "Task limit 3" }))

		expect(runInMainWindow).toHaveBeenCalledWith("setPluginSetting", {
			pluginId: "note-pulse",
			key: "reportTaskLimit",
			value: 8,
		})
	})

	it("keeps Marketplace out of Settings navigation", () => {
		setupCoreStores()

		render(
			<SettingsView
				target={{ section: "marketplace", focus: false, nonce: 0 }}
				onNavigate={vi.fn()}
				onOpenMarketplace={openMarketplaceView}
			/>,
		)

		expect(screen.queryByRole("button", { name: "Marketplace" })).not.toBeInTheDocument()
		expect(screen.getByRole("heading", { name: "General" })).toBeInTheDocument()
	})

	it("keeps long field labels and descriptions inside the shared settings layout", () => {
		const { container } = render(
			<SettingsPage>
				<SettingsSection title="Long Content">
					<SettingsGroup>
						<SettingsField
							label="A very long setting label that should remain readable without changing component style"
							description="A long description should stay in the field content column and avoid becoming a one-off text style."
						>
							<div>Control</div>
						</SettingsField>
					</SettingsGroup>
				</SettingsSection>
			</SettingsPage>,
		)

		expect(screen.getByText("Long Content")).toBeInTheDocument()
		expect(screen.getByText(/A very long setting label/)).toBeInTheDocument()
		expect(screen.getByText(/A long description/)).toBeInTheDocument()
		const section = container.querySelector('[data-slot="settings-section"]')
		const group = container.querySelector('[data-slot="settings-group"]')
		const field = container.querySelector('[data-slot="field"]')
		expect(group?.contains(section?.querySelector("h2") ?? null)).toBe(false)
		expect(field).toHaveClass("settings-field")
	})
})
