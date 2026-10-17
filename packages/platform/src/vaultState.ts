import { getPlatform } from "./index"
import { getStateFile, type StateFile, type StateFileIo } from "./stateFile"

export {
	closeStateFiles,
	flushStateFiles,
	resetStateFiles,
	type StateFile,
	type StateFileIo,
} from "./stateFile"

import { getVaultFilePath, VAULT_FILES } from "./utils"

export interface LocalVaultState {
	version: number
	tagColors: Record<string, string>
	searchHistory: string[]
	enabledPlugins: string[] | null
	propertiesExpanded: Record<string, boolean>
	onboarding: Record<string, unknown> | null
	extensionSync: ExtensionSyncMemory
}

export interface ExtensionSyncMemory {
	plugins: { known: string[]; approved: string[] }
	themes: { known: string[] }
}

export interface VaultSyncState {
	version: number
	config: Record<string, unknown>
	preferences: Record<string, unknown> | null
}

const LOCAL_STATE_DEBOUNCE_MS = 400

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readStringRecord(value: unknown): Record<string, string> {
	if (!isRecord(value)) return {}
	return Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, string] => typeof entry[1] === "string",
		),
	)
}

function readBooleanRecord(value: unknown): Record<string, boolean> {
	if (!isRecord(value)) return {}
	return Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, boolean] => typeof entry[1] === "boolean",
		),
	)
}

function readStringList(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: []
}

export function createEmptyLocalVaultState(): LocalVaultState {
	return {
		version: 1,
		tagColors: {},
		searchHistory: [],
		enabledPlugins: null,
		propertiesExpanded: {},
		onboarding: null,
		extensionSync: createEmptyExtensionSyncMemory(),
	}
}

export function createEmptyExtensionSyncMemory(): ExtensionSyncMemory {
	return { plugins: { known: [], approved: [] }, themes: { known: [] } }
}

function parseExtensionSyncMemory(value: unknown): ExtensionSyncMemory {
	if (!isRecord(value)) return createEmptyExtensionSyncMemory()
	const plugins = isRecord(value.plugins) ? value.plugins : {}
	const themes = isRecord(value.themes) ? value.themes : {}
	return {
		plugins: { known: readStringList(plugins.known), approved: readStringList(plugins.approved) },
		themes: { known: readStringList(themes.known) },
	}
}

export function parseLocalVaultState(raw: Record<string, unknown>): LocalVaultState {
	return {
		version: 1,
		tagColors: readStringRecord(raw.tagColors),
		searchHistory: readStringList(raw.searchHistory),
		enabledPlugins: Array.isArray(raw.enabledPlugins) ? readStringList(raw.enabledPlugins) : null,
		propertiesExpanded: readBooleanRecord(raw.propertiesExpanded),
		onboarding: isRecord(raw.onboarding) ? raw.onboarding : null,
		extensionSync: parseExtensionSyncMemory(raw.extensionSync),
	}
}

export function createEmptyVaultSyncState(): VaultSyncState {
	return { version: 1, config: {}, preferences: null }
}

export function parseVaultSyncState(raw: Record<string, unknown>): VaultSyncState {
	return {
		version: 1,
		config: isRecord(raw.config) ? raw.config : {},
		preferences: isRecord(raw.preferences) ? raw.preferences : null,
	}
}

function platformStateIo(): StateFileIo {
	return getPlatform().fs
}

export function getLocalVaultState(
	vaultPath: string,
	io: () => StateFileIo = platformStateIo,
): StateFile<LocalVaultState> {
	return getStateFile({
		path: getVaultFilePath(vaultPath, VAULT_FILES.localState),
		parse: parseLocalVaultState,
		empty: createEmptyLocalVaultState,
		debounceMs: LOCAL_STATE_DEBOUNCE_MS,
		io,
	})
}

export function getVaultSyncState(
	vaultPath: string,
	io: () => StateFileIo = platformStateIo,
): StateFile<VaultSyncState> {
	return getStateFile({
		path: getVaultFilePath(vaultPath, VAULT_FILES.syncState),
		parse: parseVaultSyncState,
		empty: createEmptyVaultSyncState,
		io,
	})
}
