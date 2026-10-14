import { type AddVaultPath, NEW_REMOTE } from "@cortex/core"
import type { VaultRegistryEntry } from "@cortex/platform"

import { DEFAULT_VAULT_COLOR } from "@/features/onboarding/vaultAppearance"
import type { RemoteServerKind } from "@/features/vault/vaultSyncAdapter"

export interface PickedVaultFolder {
	path: string
	name: string
}

export interface AddVaultState {
	path: AddVaultPath | null
	name: string
	color: string
	folder: PickedVaultFolder | null
	mode: "keep" | "sync" | null
	server: RemoteServerKind
	remoteId: string | null
	remoteName: string
	newRemoteName: string
	password: string
	confirm: string
	entry: VaultRegistryEntry | null
	busy: boolean
}

export function createAddVaultState(
	start: AddVaultPath | "choose",
	remoteVaultId: string | null,
): AddVaultState {
	const path = start === "choose" ? null : start
	return {
		busy: false,
		color: DEFAULT_VAULT_COLOR,
		confirm: "",
		entry: null,
		folder: null,
		mode: path === "download" ? "sync" : null,
		name: "",
		newRemoteName: "",
		password: "",
		path,
		remoteId: remoteVaultId,
		remoteName: "",
		server: "cloud",
	}
}

export function isNewRemote(state: AddVaultState): boolean {
	return state.remoteId === NEW_REMOTE
}

export function localVaultName(state: AddVaultState): string {
	if (state.path === "download") return state.remoteName
	return state.name.trim()
}

export function validatePassword(state: AddVaultState): string | null {
	return state.password ? null : "Enter your password."
}
