import {
	ADD_VAULT_FIRST_STEP,
	type AddVaultPath,
	type AddVaultStep,
	NEW_REMOTE,
	VAULT_COLORS,
} from "@cortex/core"
import type { VaultRegistryEntry } from "@cortex/platform"

import type { RemoteServerKind } from "@/features/vault/vaultSyncAdapter"

export interface PickedVaultFolder {
	path: string
	name: string
	noteCount: number | null
}

export interface AddVaultState {
	path: AddVaultPath | null
	step: AddVaultStep
	name: string
	color: string
	parentPath: string | null
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
	error: string | null
}

export function createAddVaultState(
	start: AddVaultPath | "choose",
	remoteVaultId: string | null,
): AddVaultState {
	const path = start === "choose" ? null : start
	return {
		busy: false,
		color: VAULT_COLORS[0],
		confirm: "",
		entry: null,
		error: null,
		folder: null,
		mode: path === "download" ? "sync" : null,
		name: "Second brain",
		newRemoteName: "",
		parentPath: null,
		password: "",
		path,
		remoteId: remoteVaultId,
		remoteName: "",
		server: "cloud",
		step: path ? ADD_VAULT_FIRST_STEP[path] : "choose",
	}
}

export function isNewRemote(state: AddVaultState): boolean {
	return state.remoteId === NEW_REMOTE
}

export function localVaultName(state: AddVaultState): string {
	if (state.path === "open") return state.folder?.name ?? ""
	if (state.path === "download") return state.remoteName
	return state.name.trim() || "Untitled"
}

export function validatePassword(state: AddVaultState): string | null {
	if (isNewRemote(state)) {
		if (state.password.length < 8) return "Password must be at least 8 characters"
		if (state.password !== state.confirm) return "Passwords do not match"
		return null
	}
	return state.password ? null : "Enter the password"
}
