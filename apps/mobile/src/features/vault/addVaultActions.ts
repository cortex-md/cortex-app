import {
	createDefaultSyncPreferences,
	createVaultFolder,
	linkVaultFolder,
	registerVaultFolder,
	resolvePickedFolder,
	useRemoteVaultStore,
} from "@cortex/core"
import { getPlatform, type VaultRegistryEntry } from "@cortex/platform"

import {
	type AddVaultState,
	isNewRemote,
	localVaultName,
	type PickedVaultFolder,
} from "@/features/vault/addVaultState"
import { showVaultError } from "@/features/vault/vaultErrors"
import { protectRemoteVault, unlockRemoteVault } from "@/features/vault/vaultSyncAdapter"
import { getMobileVaultFolderName } from "@/platform/vaultAccess"

export type AddVaultPatch = (patch: Partial<AddVaultState>) => void

export type PickFolderResult =
	| { kind: "picked"; folder: PickedVaultFolder }
	| { kind: "existing"; entry: VaultRegistryEntry }
	| { kind: "cancelled" }

export async function pickVaultFolder(patch: AddVaultPatch): Promise<PickFolderResult> {
	patch({ busy: true })
	try {
		const folderPath = await getPlatform().dialog.pickFolder()
		if (!folderPath) return { kind: "cancelled" }
		const picked = await resolvePickedFolder(folderPath)
		if (picked.kind === "existing") return { entry: picked.entry, kind: "existing" }
		const name = (await getMobileVaultFolderName(folderPath)) ?? ""
		const folder = { name, path: folderPath }
		patch({ folder, name, path: "open" })
		return { folder, kind: "picked" }
	} catch (error) {
		showVaultError("Couldn't open the folder", error)
		return { kind: "cancelled" }
	} finally {
		patch({ busy: false })
	}
}

async function ensureEntry(
	state: AddVaultState,
	patch: AddVaultPatch,
): Promise<VaultRegistryEntry> {
	if (state.entry) return state.entry
	const name = localVaultName(state) || "Vault"
	const folderPath =
		state.path === "open" && state.folder ? state.folder.path : await createVaultFolder(null, name)
	const entry = await registerVaultFolder(folderPath, {
		color: state.path === "download" ? null : state.color,
		name,
		syncPreferences: createDefaultSyncPreferences(),
	})
	patch({ entry })
	return entry
}

export async function finishLocalVault(
	state: AddVaultState,
	patch: AddVaultPatch,
): Promise<boolean> {
	patch({ busy: true, mode: "keep" })
	try {
		await ensureEntry(state, patch)
		return true
	} catch (error) {
		showVaultError("Couldn't add the vault", error)
		return false
	} finally {
		patch({ busy: false })
	}
}

export async function finishSyncedVault(
	state: AddVaultState,
	patch: AddVaultPatch,
): Promise<boolean> {
	patch({ busy: true })
	try {
		const entry = await ensureEntry(state, patch)
		let remoteVaultId = state.remoteId
		if (!remoteVaultId) return false
		if (isNewRemote(state)) {
			const name = state.newRemoteName.trim() || localVaultName(state)
			const created = await useRemoteVaultStore.getState().createRemoteVault(name, null)
			remoteVaultId = created.id
			patch({ remoteId: created.id, remoteName: created.name })
			await protectRemoteVault(remoteVaultId, state.password)
		} else {
			await unlockRemoteVault(remoteVaultId, state.password)
		}
		await linkVaultFolder(entry.path, remoteVaultId)
		patch({ confirm: "", password: "" })
		return true
	} catch (error) {
		showVaultError("Couldn't set up sync", error)
		return false
	} finally {
		patch({ busy: false })
	}
}
