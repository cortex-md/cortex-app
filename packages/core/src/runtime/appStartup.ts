import type { VaultMetadata, VaultRegistryEntry } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"
import { noteCache } from "../noteCache"
import { useAppStore } from "../stores/appStore"
import { useEditorStore } from "../stores/editorStore"
import { useVaultStore } from "../stores/vaultStore"
import { getRegistryOpenOptions } from "./vaultSession"

export interface StartupVaultInput {
	recentVaults: readonly VaultRegistryEntry[]
	autoOpenLastVault: boolean
}

export function completeFirstRunOnboarding(): void {
	const { firstRunOnboardingSeen, markFirstRunOnboardingSeen } = useAppStore.getState()
	if (firstRunOnboardingSeen !== false) return
	const { vault, recentVaults } = useVaultStore.getState()
	if (vault || recentVaults.length > 0) void markFirstRunOnboardingSeen()
}

export async function bootstrapApp(): Promise<void> {
	const app = useAppStore.getState()
	await Promise.all([
		app.loadAppInfo(),
		app.loadFirstRunOnboarding(),
		useVaultStore.getState().loadRecentVaults(),
		useSettingsStore.getState().loadGlobalSettings(),
	])
	completeFirstRunOnboarding()
}

export function resolveStartupVault({
	recentVaults,
	autoOpenLastVault,
}: StartupVaultInput): VaultRegistryEntry | null {
	return autoOpenLastVault ? (recentVaults[0] ?? null) : null
}

export async function openLastVault(): Promise<VaultMetadata | null> {
	const vaultState = useVaultStore.getState()
	if (vaultState.vault) return vaultState.vault
	const entry = resolveStartupVault({
		recentVaults: vaultState.recentVaults,
		autoOpenLastVault: useSettingsStore.getState().settings.general.autoOpenLastVault,
	})
	if (!entry) return null
	await vaultState.openVault(entry.path, getRegistryOpenOptions(entry))
	const { vault, error } = useVaultStore.getState()
	if (vault) return vault
	await useVaultStore.getState().closeVault()
	throw new Error(error ?? `Unable to open ${entry.name}`)
}

export async function flushPendingWrites(): Promise<void> {
	await Promise.all([noteCache.flushAll(), useEditorStore.getState().flushActive()])
}
