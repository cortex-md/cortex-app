import { type Mock, vi } from "vitest"

interface SyncSettingsPlatformMocks {
	showConfirm: Mock<() => Promise<boolean>>
	keychainGet: Mock<() => Promise<string | null>>
	keychainSet: Mock<(...arguments_: unknown[]) => Promise<void>>
	keychainDelete: Mock<(...arguments_: unknown[]) => Promise<void>>
	saveFile: Mock<() => Promise<string | null>>
	writeFile: Mock<(...arguments_: unknown[]) => Promise<void>>
}

const platformMocks: SyncSettingsPlatformMocks = vi.hoisted(() => ({
	showConfirm: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
	keychainGet: vi.fn<() => Promise<string | null>>().mockResolvedValue(null),
	keychainSet: vi.fn<(...arguments_: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
	keychainDelete: vi.fn<(...arguments_: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
	saveFile: vi.fn<() => Promise<string | null>>().mockResolvedValue("/exports/.env"),
	writeFile: vi.fn<(...arguments_: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
}))

vi.mock("@cortex/core", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@cortex/core")>()
	return {
		...actual,
		DEFAULT_SYNC_SERVER_URL: "http://localhost:8080",
		useAuthStore: vi.fn(),
		useDevicesStore: vi.fn(),
		useRemoteVaultStore: vi.fn(),
		useSyncStore: vi.fn(),
		useSubscriptionStore: vi.fn(),
		useUIStore: vi.fn(),
		useVaultStore: vi.fn(),
	}
})

vi.mock("@cortex/platform", () => ({
	getPlatform: vi.fn(() => ({
		dialog: {
			showConfirm: platformMocks.showConfirm,
			saveFile: platformMocks.saveFile,
		},
		fs: {
			writeFile: platformMocks.writeFile,
		},
		keychain: {
			get: platformMocks.keychainGet,
			set: platformMocks.keychainSet,
			delete: platformMocks.keychainDelete,
		},
	})),
}))

vi.mock("../../../features/sync/MembersPanel", () => ({
	MembersPanel: () => <div>Members panel</div>,
}))

vi.mock("../../../features/sync/VaultLinkModal", () => ({
	VaultLinkModal: () => null,
}))

vi.mock("../../../features/settings/ExcludedPathsSettings", () => ({
	ExcludedPathsSettings: () => <div>Excluded paths panel</div>,
}))

import {
	useAuthStore,
	useDevicesStore,
	useRemoteVaultStore,
	useSubscriptionStore,
	useSyncStore,
	useUIStore,
	useVaultStore,
} from "@cortex/core"

type AsyncMock = Mock<(...arguments_: unknown[]) => Promise<void>>

export const openAuth: Mock<(...arguments_: unknown[]) => void> = vi.fn()
export const setSyncEnabled: AsyncMock = vi.fn().mockResolvedValue(undefined)
const saveServerUrl: AsyncMock = vi.fn().mockResolvedValue(undefined)
export const setSelfHosted: AsyncMock = vi.fn().mockResolvedValue(undefined)
export const updateSelfHostedEnvironment: AsyncMock = vi.fn().mockResolvedValue(undefined)
const unlinkVault: AsyncMock = vi.fn().mockResolvedValue(undefined)
const loadLink: AsyncMock = vi.fn().mockResolvedValue(undefined)
export const fetchRemoteVaults: AsyncMock = vi.fn().mockResolvedValue(undefined)
export const fetchDevices: AsyncMock = vi.fn().mockResolvedValue(undefined)
const refreshSubscriptionStatus: AsyncMock = vi.fn().mockResolvedValue(undefined)
export const openBillingPage: Mock<(...arguments_: unknown[]) => Promise<string>> = vi
	.fn()
	.mockResolvedValue("https://app.example.com/billing")
const updateSyncPreference: AsyncMock = vi.fn().mockResolvedValue(undefined)

export function getSyncSettingsPlatformMocks(): SyncSettingsPlatformMocks {
	return platformMocks
}

interface SyncSettingsMockOverrides {
	authenticated?: boolean
	syncEnabled?: boolean
	selfHosted?: boolean
	linkedVaultId?: string | null
	remoteVaults?: Array<{
		id: string
		name: string
		role: string
		memberCount?: number
	}>
	engineState?: string
	lastSyncedAt?: number | null
	deviceEntries?: Array<{ id: string; revoked: boolean }>
	devicesLoading?: boolean
	files?: Array<{ name: string; path: string; isDir: boolean }>
	selfHostedEnvironment?: Record<string, string>
	subscriptionBlock?: { code: string; message: string } | null
}

const mockVault = { path: "/vault", name: "Test Vault", uuid: "vault-id" }

export function setupSyncSettingsMocks(overrides: SyncSettingsMockOverrides = {}) {
	vi.mocked(useUIStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = { openAuth }
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useAuthStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = {
			authenticated: overrides.authenticated ?? false,
		}
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useVaultStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = {
			vault: mockVault,
			files: overrides.files ?? [
				{ name: "One.md", path: "/vault/One.md", isDir: false },
				{ name: "image.png", path: "/vault/image.png", isDir: false },
			],
		}
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useRemoteVaultStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const linkedVaultId = overrides.linkedVaultId ?? null
		const state = {
			linkedVaultId,
			remoteVaults: overrides.remoteVaults ?? [],
			loadLink,
			fetchRemoteVaults,
			setSyncEnabled,
			saveServerUrl,
			setSelfHosted,
			unlinkVault,
			updateSelfHostedEnvironment,
			syncConfig: {
				enabled: overrides.syncEnabled ?? false,
				remoteVaultId: linkedVaultId,
				selfHosted: overrides.selfHosted ?? false,
				serverUrl: "https://sync.example.com",
				offlineMode: false,
				selfHostedEnvironment: overrides.selfHostedEnvironment ?? {},
			},
		}
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useDevicesStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = {
			deviceEntries: overrides.deviceEntries ?? [],
			loading: overrides.devicesLoading ?? false,
			error: null,
			fetchDevices,
		}
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useSyncStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = {
			engineState: overrides.engineState ?? "idle",
			lastSyncedAt: overrides.lastSyncedAt ?? null,
			syncPreferences: {
				syncSettings: false,
				syncHotkeys: false,
				syncWorkspace: false,
				syncPluginMetadata: false,
				syncThemeMetadata: false,
				syncBookmarks: false,
				ignoreImages: false,
				excludedPaths: [],
			},
			updateSyncPreference,
		}
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useSubscriptionStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = {
			block: overrides.subscriptionBlock ?? null,
			loading: false,
			refreshStatus: refreshSubscriptionStatus,
			openBillingPage,
		}
		return selector ? selector(state) : state
	}) as never)
}
