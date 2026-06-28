import type { FileEntry, VaultMetadata, VaultRegistryEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
	createNoteWithPropertyDefaults,
	getOptionalPropertiesRuntime,
	invalidatePropertySuggestions,
	notifyVaultSchemaChanged,
	prepareDuplicatedNote,
	removeNotePropertiesUiState,
	renameNotePropertiesUiState,
} from "@cortex/properties"
import { getSettingsManager, initSettingsManager } from "@cortex/settings"
import { create } from "zustand"
import { noteCache } from "../noteCache"
import { ensureVaultOnboardingNote } from "../onboarding/vaultOnboarding"
import { pathExists, resolveUniquePath, splitFileName, writeCleanNote } from "../utils/createdNote"
import { getPortableFileNameError } from "../utils/fileName"
import { createDefaultFrontmatter } from "../utils/frontmatter"
import { useBookmarksStore } from "./bookmarksStore"
import { useSyncStore } from "./syncStore"
import { useTemplateStore } from "./templateStore"
import { setVaultRuntimeState } from "./vaultRuntime"
import { useWorkspaceStore } from "./workspaceStore"

export type { VaultMetadata, VaultRegistryEntry }

const WATCHER_REFRESH_DELAY_MS = 200

let watcherRefreshTimer: ReturnType<typeof setTimeout> | null = null
let watcherRefreshPromise: Promise<void> | null = null
let trailingWatcherRefresh: (() => Promise<void>) | null = null
let watcherRefreshGeneration = 0

export interface OpenVaultOptions {
	icon?: string
	color?: string
	name?: string
	createOnboardingNote?: boolean
}

function isMarkdownPath(path: string): boolean {
	return path.toLocaleLowerCase().endsWith(".md")
}

function isPropertySchemaPath(path: string): boolean {
	const normalized = path.replaceAll("\\", "/")
	return (
		normalized === ".cortex/schema/properties.json" ||
		normalized.endsWith("/.cortex/schema/properties.json")
	)
}

function getParentPath(filePath: string): string {
	return filePath.substring(0, filePath.lastIndexOf("/"))
}

function getFileName(filePath: string): string {
	return filePath.split("/").pop() ?? filePath
}

function isPathOrDescendant(path: string, parentPath: string): boolean {
	return path === parentPath || path.startsWith(`${parentPath}/`)
}

async function writeCleanNoteAndRefreshFiles(
	filePath: string,
	content: string,
	refreshFiles: () => Promise<void>,
): Promise<void> {
	await writeCleanNote(filePath, content)
	await refreshFiles()
}

async function writeDailyNoteAndRefreshFiles(
	filePath: string,
	vaultPath: string,
	dateStr: string,
	dailyDir: string,
	dailyDirExists: boolean,
	refreshFiles: () => Promise<void>,
): Promise<void> {
	const [content] = await Promise.all([
		createNoteWithPropertyDefaults(
			vaultPath,
			createDefaultFrontmatter({
				tags: ["daily"],
				extraFields: { date: dateStr },
			}),
		),
		dailyDirExists ? Promise.resolve() : getPlatform().fs.createDir(dailyDir),
	])
	await writeCleanNoteAndRefreshFiles(filePath, `${content}\n# ${dateStr}\n\n`, refreshFiles)
}

function getAffectedNotePaths(files: FileEntry[], oldPath: string): string[] {
	const paths = files.flatMap((file) =>
		!file.isDir && isPathOrDescendant(file.path, oldPath) ? [file.path] : [],
	)
	return paths.length > 0 ? paths : [oldPath]
}

async function flushAffectedNotes(files: FileEntry[], oldPath: string): Promise<void> {
	await Promise.all(getAffectedNotePaths(files, oldPath).map((path) => noteCache.flush(path)))
}

async function renameAfterFlushingAffectedNotes(
	files: FileEntry[],
	oldPath: string,
	newPath: string,
): Promise<string[]> {
	const affectedNotePaths = getAffectedNotePaths(files, oldPath)
	await Promise.all(affectedNotePaths.map((path) => noteCache.flush(path)))
	await getPlatform().fs.renameFile(oldPath, newPath)
	return affectedNotePaths
}

async function migrateVaultPathReferences(
	vaultPath: string,
	oldPath: string,
	newPath: string,
): Promise<void> {
	noteCache.renamePath(oldPath, newPath)
	useWorkspaceStore.getState().updateTabPath(oldPath, newPath)
	await useBookmarksStore.getState().renameBookmarkPath(vaultPath, oldPath, newPath)
	if (getOptionalPropertiesRuntime()) {
		await renameNotePropertiesUiState(vaultPath, oldPath, newPath)
	}
}

function getMoveDestinationPath(oldPath: string, targetParentPath: string): string {
	return `${targetParentPath}/${getFileName(oldPath)}`
}

function startWatcherRefresh(refreshFiles: () => Promise<void>, generation: number): void {
	if (watcherRefreshPromise) {
		trailingWatcherRefresh = refreshFiles
		return
	}

	watcherRefreshPromise = (async () => {
		let nextRefresh: (() => Promise<void>) | null = refreshFiles
		while (nextRefresh && generation === watcherRefreshGeneration) {
			await nextRefresh()
			const shouldContinue = generation === watcherRefreshGeneration
			nextRefresh = shouldContinue ? trailingWatcherRefresh : null
			trailingWatcherRefresh = null
		}
	})().finally(() => {
		watcherRefreshPromise = null
		const nextRefresh = trailingWatcherRefresh
		trailingWatcherRefresh = null
		if (nextRefresh) startWatcherRefresh(nextRefresh, watcherRefreshGeneration)
	})
}

function scheduleWatcherRefresh(refreshFiles: () => Promise<void>): void {
	if (watcherRefreshTimer) clearTimeout(watcherRefreshTimer)
	const generation = watcherRefreshGeneration
	watcherRefreshTimer = setTimeout(() => {
		watcherRefreshTimer = null
		startWatcherRefresh(refreshFiles, generation)
	}, WATCHER_REFRESH_DELAY_MS)
}

function clearWatcherRefresh(): void {
	if (watcherRefreshTimer) clearTimeout(watcherRefreshTimer)
	watcherRefreshTimer = null
	trailingWatcherRefresh = null
	watcherRefreshGeneration += 1
}

export interface VaultState {
	vault: VaultMetadata | null
	files: FileEntry[]
	recentVaults: VaultRegistryEntry[]
	loading: boolean
	error: string | null
	stopWatcher: (() => void) | null
	pendingOnboardingNotePath: string | null

	openVault: (path: string, options?: OpenVaultOptions) => Promise<void>
	loadVaultSnapshot: (path: string) => Promise<void>
	closeVault: () => Promise<void>
	refreshFiles: () => Promise<void>
	loadRecentVaults: () => Promise<void>
	clearPendingOnboardingNotePath: () => void
	removeRecentVault: (uuid: string) => Promise<void>
	createFile: (parentPath: string, name: string) => Promise<string>
	createFolder: (parentPath: string, name: string) => Promise<string>
	deleteFile: (filePath: string) => Promise<void>
	renameFile: (oldPath: string, newName: string) => Promise<string>
	moveFile: (oldPath: string, targetParentPath: string) => Promise<string>
	duplicateFile: (filePath: string) => Promise<string>
	openDailyNote: () => Promise<string | null>
}

export const useVaultStore = create<VaultState>((set, get) => ({
	vault: null,
	files: [],
	recentVaults: [],
	loading: false,
	error: null,
	stopWatcher: null,
	pendingOnboardingNotePath: null,

	openVault: async (path, options) => {
		const platform = getPlatform()
		set({ loading: true, error: null, pendingOnboardingNotePath: null })
		try {
			const metadata = await platform.vault.openVault(path)
			let pendingOnboardingNotePath: string | null = null
			if (options?.createOnboardingNote) {
				try {
					const onboarding = await ensureVaultOnboardingNote(metadata.path)
					pendingOnboardingNotePath = onboarding.notePath
				} catch (error) {
					console.error("[Vault onboarding note creation failed]", {
						vaultPath: metadata.path,
						error,
					})
				}
			}
			const [files] = await Promise.all([
				platform.vault.scanVault(metadata.path),
				platform.vault.updateVaultRegistry(
					metadata.uuid,
					metadata.path,
					options?.name ?? metadata.name,
					options?.icon,
					options?.color,
				),
			])

			const stopWatcher = await platform.fs.startWatching(metadata.path, async (event) => {
				scheduleWatcherRefresh(get().refreshFiles)
				if (isPropertySchemaPath(event.path)) {
					notifyVaultSchemaChanged(metadata.path)
				} else if (isMarkdownPath(event.path)) {
					invalidatePropertySuggestions(metadata.path)
				}
				if (event.kind !== "created" && event.kind !== "modified") return
				if (!noteCache.getEntry(event.path)) return
				try {
					const hash = await platform.fs.hashFile(event.path)
					await noteCache.handleExternalChange(event.path, hash)
				} catch (error) {
					console.error("[Vault file change failed]", { path: event.path, error })
				}
			})

			initSettingsManager()
			await Promise.all([
				getSettingsManager().loadFromVault(metadata.path),
				useBookmarksStore.getState().loadBookmarks(metadata.path),
				useSyncStore.getState().loadSyncPreferences(metadata.path),
				useTemplateStore.getState().loadTemplates(metadata),
			])

			set({
				vault: metadata,
				files,
				loading: false,
				stopWatcher,
				pendingOnboardingNotePath,
			})

			await get().loadRecentVaults()
		} catch (e) {
			set({ loading: false, error: String(e) })
		}
	},

	loadVaultSnapshot: async (path) => {
		const platform = getPlatform()
		set({ loading: true, error: null })
		try {
			const metadata = await platform.vault.openVault(path)
			const files = await platform.vault.scanVault(metadata.path)

			initSettingsManager()
			await Promise.all([
				getSettingsManager().loadFromVault(metadata.path),
				useBookmarksStore.getState().loadBookmarks(metadata.path),
				useSyncStore.getState().loadSyncPreferences(metadata.path),
				useTemplateStore.getState().loadTemplates(metadata),
			])

			set({
				vault: metadata,
				files,
				loading: false,
				pendingOnboardingNotePath: null,
			})
		} catch (e) {
			set({ loading: false, error: String(e) })
		}
	},

	closeVault: async () => {
		const { stopWatcher } = get()
		stopWatcher?.()
		clearWatcherRefresh()
		await getSettingsManager().flush()
		useBookmarksStore.getState().reset()
		useTemplateStore.getState().reset()
		set({
			vault: null,
			files: [],
			stopWatcher: null,
			error: null,
			pendingOnboardingNotePath: null,
		})
	},

	refreshFiles: async () => {
		const { vault } = get()
		if (!vault) return
		try {
			const files = await getPlatform().vault.scanVault(vault.path)
			set({ files })
		} catch (error) {
			console.error("[Vault refresh failed]", { vaultPath: vault.path, error })
			set({ error: String(error) })
		}
	},

	loadRecentVaults: async () => {
		try {
			const platform = getPlatform()
			const entries = await platform.vault.readVaultRegistry()
			const sorted = [...entries].sort((a, b) => (b.lastOpened ?? 0) - (a.lastOpened ?? 0))
			set({ recentVaults: sorted })
			try {
				await platform.vault.refreshMenuRecents()
			} catch (error) {
				console.error("[Recent vault menu refresh failed]", { error })
			}
		} catch (error) {
			console.error("[Recent vault load failed]", { error })
			set({ error: String(error) })
		}
	},

	clearPendingOnboardingNotePath: () => {
		set({ pendingOnboardingNotePath: null })
	},

	removeRecentVault: async (uuid) => {
		try {
			await getPlatform().vault.removeFromVaultRegistry(uuid)
			await get().loadRecentVaults()
		} catch (error) {
			console.error("[Recent vault removal failed]", { uuid, error })
			set({ error: String(error) })
		}
	},

	createFile: async (parentPath, name) => {
		const fileName = name.endsWith(".md") ? name : `${name}.md`
		const validationError = getPortableFileNameError(fileName)
		if (validationError) throw new Error(validationError)
		const vaultPath = get().vault?.path
		const [filePath, content] = await Promise.all([
			resolveUniquePath(parentPath, fileName),
			createNoteWithPropertyDefaults(vaultPath ?? parentPath, createDefaultFrontmatter()),
		])
		await writeCleanNoteAndRefreshFiles(filePath, content, get().refreshFiles)
		invalidatePropertySuggestions(vaultPath)
		return filePath
	},

	createFolder: async (parentPath, name) => {
		const platform = getPlatform()
		const validationError = getPortableFileNameError(name)
		if (validationError) throw new Error(validationError)
		const folderPath = await resolveUniquePath(parentPath, name)
		await platform.fs.createDir(folderPath)
		await get().refreshFiles()
		return folderPath
	},

	deleteFile: async (filePath) => {
		const platform = getPlatform()
		const vaultPath = get().vault?.path
		const deletedEntry = get().files.find((file) => file.path === filePath)
		await platform.fs.deleteFile(filePath)
		noteCache.forget(filePath, { descendants: deletedEntry?.isDir ?? false })
		if (vaultPath) {
			await useBookmarksStore.getState().removeBookmarksUnderPath(vaultPath, filePath)
		}
		if (vaultPath && getOptionalPropertiesRuntime()) {
			await removeNotePropertiesUiState(vaultPath, filePath)
		}
		await get().refreshFiles()
		if (vaultPath && isMarkdownPath(filePath)) invalidatePropertySuggestions(vaultPath)
	},

	renameFile: async (oldPath, newName) => {
		const platform = getPlatform()
		const validationError = getPortableFileNameError(newName)
		if (validationError) throw new Error(validationError)
		const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/"))
		const newPath = `${parentPath}/${newName}`
		if (oldPath === newPath) return oldPath

		const files = get().files
		await flushAffectedNotes(files, oldPath)
		await platform.fs.renameFile(oldPath, newPath)
		const vaultPath = get().vault?.path
		if (vaultPath) {
			await migrateVaultPathReferences(vaultPath, oldPath, newPath)
		}
		await get().refreshFiles()
		if (vaultPath && (isMarkdownPath(oldPath) || isMarkdownPath(newPath))) {
			invalidatePropertySuggestions(vaultPath)
		}
		return newPath
	},

	moveFile: async (oldPath, targetParentPath) => {
		const { files, vault } = get()
		if (!vault) throw new Error("No vault is open")
		if (oldPath === vault.path) throw new Error("The vault root cannot be moved")

		const sourceEntry = files.find((file) => file.path === oldPath)
		if (!sourceEntry) throw new Error("Source file or folder was not found")

		const normalizedTargetParent = targetParentPath.replace(/\/+$/, "")
		if (!isPathOrDescendant(normalizedTargetParent, vault.path)) {
			throw new Error("Destination must be inside the current vault")
		}
		if (normalizedTargetParent !== vault.path) {
			const targetParent = files.find((file) => file.path === normalizedTargetParent)
			if (!targetParent?.isDir) throw new Error("Destination folder was not found")
		}
		if (sourceEntry.isDir && isPathOrDescendant(normalizedTargetParent, oldPath)) {
			throw new Error("A folder cannot be moved into itself")
		}

		const newPath = getMoveDestinationPath(oldPath, normalizedTargetParent)
		if (newPath === oldPath) return oldPath
		if (files.some((file) => file.path === newPath)) {
			throw new Error("Destination already exists")
		}

		const affectedNotePaths = await renameAfterFlushingAffectedNotes(files, oldPath, newPath)
		await Promise.all([
			migrateVaultPathReferences(vault.path, oldPath, newPath),
			get().refreshFiles(),
		])
		if (
			isMarkdownPath(oldPath) ||
			isMarkdownPath(newPath) ||
			affectedNotePaths.some(isMarkdownPath)
		) {
			invalidatePropertySuggestions(vault.path)
		}
		return newPath
	},

	duplicateFile: async (filePath) => {
		const parentPath = getParentPath(filePath)
		const { baseName, extension } = splitFileName(getFileName(filePath))
		const vaultPath = get().vault?.path
		const [newPath, content] = await Promise.all([
			resolveUniquePath(parentPath, `${baseName} (copy)${extension}`),
			getPlatform().fs.readFile(filePath),
		])
		const duplicatedContent = vaultPath ? await prepareDuplicatedNote(vaultPath, content) : content
		await writeCleanNoteAndRefreshFiles(newPath, duplicatedContent, get().refreshFiles)
		if (vaultPath && isMarkdownPath(newPath)) invalidatePropertySuggestions(vaultPath)
		return newPath
	},

	openDailyNote: async () => {
		const { vault, files } = get()
		if (!vault) return null

		const today = new Date()
		const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
		const dailyDir = `${vault.path}/Daily`
		const filePath = `${dailyDir}/${dateStr}.md`

		const existingFile = files.find((f) => f.path === filePath)
		if (existingFile) return filePath
		if (await pathExists(filePath)) return filePath

		const dailyDirExists = files.some((f) => f.isDir && f.path === dailyDir)
		await writeDailyNoteAndRefreshFiles(
			filePath,
			vault.path,
			dateStr,
			dailyDir,
			dailyDirExists,
			get().refreshFiles,
		)
		invalidatePropertySuggestions(vault.path)
		return filePath
	},
}))

useVaultStore.subscribe((state) => {
	setVaultRuntimeState(state.vault?.path ?? null, state.refreshFiles)
})

const initialVaultState = useVaultStore.getState()
setVaultRuntimeState(initialVaultState.vault?.path ?? null, initialVaultState.refreshFiles)
