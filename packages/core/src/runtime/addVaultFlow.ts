import { getPlatform, type VaultRegistryEntry } from "@cortex/platform"
import { createStore } from "zustand/vanilla"
import { useRemoteVaultStore } from "../stores/remoteVaultStore"
import { createDefaultSyncPreferences } from "../stores/syncStore"
import { useVaultStore } from "../stores/vaultStore"
import { createVaultFolder, registerVaultFolder, VAULT_COLORS } from "./addVault"
import { formatVaultPath } from "./vaultDisplay"
import { resolvePickedFolder } from "./vaultSession"

export const NEW_REMOTE = "new"

export type AddVaultPath = "create" | "open" | "download"

export interface AddVaultTarget {
	start: "choose" | AddVaultPath
	remoteVaultId?: string
}

export type AddVaultStep =
	| "choose"
	| "name"
	| "folder"
	| "sync"
	| "remote"
	| "location"
	| "password"
	| "done"

export type SyncMode = "keep" | "sync"

export interface PickedFolderInfo {
	path: string
	displayPath: string
	name: string
	noteCount: number | null
	obsidian: boolean
}

export const ADD_VAULT_STEP_LABELS: Record<Exclude<AddVaultStep, "choose">, string> = {
	name: "Name",
	folder: "Folder",
	sync: "Sync",
	remote: "Remote vault",
	location: "Folder",
	password: "Password",
	done: "Done",
}

export const ADD_VAULT_FIRST_STEP: Record<AddVaultPath, AddVaultStep> = {
	create: "name",
	open: "folder",
	download: "remote",
}

export function addVaultStepsFor(path: AddVaultPath, syncing: boolean): AddVaultStep[] {
	if (path === "download") return ["remote", "location", "password", "done"]
	const first = ADD_VAULT_FIRST_STEP[path]
	return syncing ? [first, "sync", "remote", "password", "done"] : [first, "sync", "done"]
}

export interface AddVaultDraft {
	path: AddVaultPath | null
	step: AddVaultStep
	name: string
	color: string
	parentPath: string | null
	folder: PickedFolderInfo | null
	picking: boolean
	adoptObsidian: boolean
	mode: SyncMode | null
	remoteId: string | null
	newRemoteName: string
	linkedRemoteName: string | null
	entry: VaultRegistryEntry | null
	busy: boolean
	error: string | null
}

export function createAddVaultDraft(target: AddVaultTarget): AddVaultDraft {
	const path = target.start === "choose" ? null : target.start
	return {
		path,
		step: path ? ADD_VAULT_FIRST_STEP[path] : "choose",
		name: "Second brain",
		color: VAULT_COLORS[0],
		parentPath: null,
		folder: null,
		picking: false,
		adoptObsidian: true,
		mode: path === "download" ? "sync" : null,
		remoteId: target.remoteVaultId ?? null,
		newRemoteName: "",
		linkedRemoteName: null,
		entry: null,
		busy: false,
		error: null,
	}
}

export interface AddVaultNames {
	localName: string
	remoteName: string
}

export function resolveAddVaultNames(
	draft: AddVaultDraft,
	selectedRemoteName: string | undefined,
): AddVaultNames {
	const { path } = draft
	const isNewRemote = draft.remoteId === NEW_REMOTE
	const localName =
		path === "open"
			? (draft.folder?.name ?? "")
			: path === "download"
				? (selectedRemoteName ?? draft.linkedRemoteName ?? "")
				: draft.name.trim() || "Untitled"
	const remoteName = isNewRemote
		? draft.newRemoteName.trim() || localName
		: (selectedRemoteName ?? draft.linkedRemoteName ?? "")
	return { localName, remoteName }
}

export interface AddVaultOpenOptions {
	createOnboardingNote: boolean
}

export interface AddVaultFlowDeps {
	close: () => void
	isObsidianVault: (folderPath: string) => Promise<boolean>
	openVault: (entry: VaultRegistryEntry, options: AddVaultOpenOptions) => Promise<void>
	linkRemote: (remoteVaultId: string, vaultPath: string) => Promise<void>
	onOpened?: (result: { opensHere: boolean; adoptObsidian: boolean }) => void
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export function createAddVaultFlow(target: AddVaultTarget, deps: AddVaultFlowDeps) {
	const store = createStore<AddVaultDraft>(() => createAddVaultDraft(target))
	const update = (next: Partial<AddVaultDraft>) => store.setState(next)
	const draft = () => store.getState()

	const pickFolder = async () => {
		update({ picking: true })
		try {
			const folderPath = await getPlatform().dialog.pickFolder()
			if (!folderPath) return
			const picked = await resolvePickedFolder(folderPath)
			if (picked.kind === "existing") {
				deps.close()
				await deps.openVault(picked.entry, { createOnboardingNote: false })
				return
			}
			update({
				folder: {
					path: folderPath,
					displayPath: formatVaultPath(folderPath),
					name: picked.defaultName,
					noteCount: null,
					obsidian: false,
				},
			})
			const [files, obsidian] = await Promise.all([
				getPlatform()
					.vault.scanVault(folderPath)
					.catch(() => []),
				deps.isObsidianVault(folderPath).catch(() => false),
			])
			const noteCount = files.filter((file) => !file.isDir && file.path.endsWith(".md")).length
			store.setState((current) =>
				current.folder?.path === folderPath
					? { ...current, folder: { ...current.folder, noteCount, obsidian } }
					: current,
			)
		} catch (error) {
			update({ error: errorMessage(error) })
		} finally {
			update({ picking: false })
		}
	}

	const pickParent = async () => {
		const parentPath = await getPlatform().dialog.pickFolder()
		if (parentPath) update({ parentPath })
	}

	const ensureEntry = async ({ localName }: AddVaultNames): Promise<VaultRegistryEntry> => {
		const { entry: existing, path, folder, parentPath, color } = draft()
		if (existing) return existing
		const folderPath =
			path === "open" && folder ? folder.path : await createVaultFolder(parentPath, localName)
		const entry = await registerVaultFolder(folderPath, {
			name: localName,
			color: path === "create" ? color : null,
			syncPreferences: createDefaultSyncPreferences(),
		})
		update({ entry })
		return entry
	}

	const run = async (task: () => Promise<void>) => {
		update({ busy: true, error: null })
		try {
			await task()
		} catch (error) {
			update({ error: errorMessage(error) })
		} finally {
			update({ busy: false })
		}
	}

	const finishLocal = (names: AddVaultNames) =>
		run(async () => {
			await ensureEntry(names)
			update({ step: "done" })
		})

	const startSync = (names: AddVaultNames) =>
		run(async () => {
			const entry = await ensureEntry(names)
			let remoteVaultId = draft().remoteId
			if (!remoteVaultId) return
			if (remoteVaultId === NEW_REMOTE) {
				const created = await useRemoteVaultStore
					.getState()
					.createRemoteVault(names.remoteName, null)
				remoteVaultId = created.id
				update({ remoteId: created.id, linkedRemoteName: created.name })
			} else {
				update({ linkedRemoteName: names.remoteName })
			}
			update({ step: "password" })
			await deps.linkRemote(remoteVaultId, entry.path)
		})

	const openVault = async () => {
		const { entry, path, folder, adoptObsidian } = draft()
		if (!entry) return
		const opensHere = useVaultStore.getState().vault === null
		deps.close()
		await deps.openVault(entry, {
			createOnboardingNote: path === "create" || (path === "open" && folder?.noteCount === 0),
		})
		deps.onOpened?.({ opensHere, adoptObsidian: Boolean(folder?.obsidian && adoptObsidian) })
	}

	const go = (nextStep: AddVaultStep) => update({ step: nextStep, error: null })

	const back = (steps: readonly AddVaultStep[]) => {
		const { step, mode } = draft()
		const stepIndex = steps.indexOf(step)
		if (step === "done" && mode === "keep") return go("sync")
		if (stepIndex > 0) return go(steps[stepIndex - 1] ?? "choose")
		if (target.start === "choose") update({ path: null, step: "choose", error: null })
	}

	const canGoBack = (steps: readonly AddVaultStep[]) => {
		const { step, mode } = draft()
		const stepIndex = steps.indexOf(step)
		return (
			step !== "choose" &&
			(step !== "done" || mode === "keep") &&
			(stepIndex > 0 || target.start === "choose")
		)
	}

	const choosePath = (nextPath: AddVaultPath) =>
		update({
			path: nextPath,
			step: ADD_VAULT_FIRST_STEP[nextPath],
			mode: nextPath === "download" ? "sync" : null,
			remoteId: null,
			error: null,
		})

	const selectRemote = (remoteId: string, localName: string) =>
		update({
			remoteId,
			newRemoteName:
				remoteId === NEW_REMOTE ? draft().newRemoteName || localName : draft().newRemoteName,
		})

	const keepLocalInstead = (names: AddVaultNames) => {
		update({ mode: "keep" })
		void finishLocal(names)
	}

	return {
		store,
		update,
		pickFolder,
		pickParent,
		finishLocal,
		startSync,
		openVault,
		go,
		back,
		canGoBack,
		choosePath,
		selectRemote,
		keepLocalInstead,
	}
}

export type AddVaultFlow = ReturnType<typeof createAddVaultFlow>
