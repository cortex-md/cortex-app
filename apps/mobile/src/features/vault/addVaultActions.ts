import {
	createDefaultSyncPreferences,
	formatVaultPath,
	getErrorMessage,
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
import {
	createLocalVaultFolder,
	protectRemoteVault,
	unlockRemoteVault,
} from "@/features/vault/vaultSyncAdapter"

export type AddVaultPatch = (patch: Partial<AddVaultState>) => void

export type PickFolderResult =
	| { kind: "picked"; folder: PickedVaultFolder }
	| { kind: "existing"; entry: VaultRegistryEntry }
	| { kind: "cancelled" }

export async function pickVaultFolder(patch: AddVaultPatch): Promise<PickFolderResult> {
	patch({ busy: true, error: null })
	try {
		const folderPath = await getPlatform().dialog.pickFolder()
		if (!folderPath) return { kind: "cancelled" }
		const picked = await resolvePickedFolder(folderPath)
		if (picked.kind === "existing") return { entry: picked.entry, kind: "existing" }
		const files = await getPlatform()
			.vault.scanVault(folderPath)
			.catch(() => [])
		const noteCount = files.filter((file) => !file.isDir && file.path.endsWith(".md")).length
		const folder = { name: picked.defaultName, noteCount, path: folderPath }
		patch({ folder })
		return { folder, kind: "picked" }
	} catch (error) {
		patch({ error: getErrorMessage(error) })
		return { kind: "cancelled" }
	} finally {
		patch({ busy: false })
	}
}

export async function pickParentFolder(patch: AddVaultPatch): Promise<void> {
	try {
		const parentPath = await getPlatform().dialog.pickFolder()
		if (parentPath) patch({ parentPath })
	} catch (error) {
		patch({ error: getErrorMessage(error) })
	}
}

export function describeLocation(state: AddVaultState, defaultLabel: string): string {
	const parent = state.parentPath ? formatVaultPath(state.parentPath) : defaultLabel
	const name = localVaultName(state)
	return name ? `${parent} › ${name}` : parent
}

async function ensureEntry(state: AddVaultState, patch: AddVaultPatch): Promise<VaultRegistryEntry> {
	if (state.entry) return state.entry
	const name = localVaultName(state)
	const folderPath =
		state.path === "open" && state.folder
			? state.folder.path
			: await createLocalVaultFolder(state.parentPath, name)
	const entry = await registerVaultFolder(folderPath, {
		color: state.path === "create" ? state.color : null,
		name,
		syncPreferences: createDefaultSyncPreferences(),
	})
	patch({ entry })
	return entry
}

export async function finishLocalVault(state: AddVaultState, patch: AddVaultPatch): Promise<void> {
	patch({ busy: true, error: null, mode: "keep" })
	try {
		await ensureEntry(state, patch)
		patch({ step: "done" })
	} catch (error) {
		patch({ error: getErrorMessage(error) })
	} finally {
		patch({ busy: false })
	}
}

export async function finishSyncedVault(state: AddVaultState, patch: AddVaultPatch): Promise<void> {
	patch({ busy: true, error: null })
	try {
		const entry = await ensureEntry(state, patch)
		let remoteVaultId = state.remoteId
		if (!remoteVaultId) return
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
		patch({ confirm: "", password: "", step: "done" })
	} catch (error) {
		patch({ error: getErrorMessage(error) })
	} finally {
		patch({ busy: false })
	}
}
