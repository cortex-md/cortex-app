import type {
	FileEntry,
	VaultMetadata,
	VaultRegistryEntry,
	VaultRegistryPatch,
	WatchEvent,
} from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
	ensureMarkdownExtension,
	getBaseName,
	getParentPath,
	isMarkdownPath,
	isPathOrDescendant,
	joinPath,
	normalizePath,
	splitExtension,
	toVaultRelativePath,
	VAULT_FILES,
} from "@cortex/platform/utils"
import { sortRecentVaults } from "@cortex/platform/vault"
import {
	createNoteWithPropertyDefaults,
	getOptionalPropertiesRuntime,
	invalidatePropertySuggestions,
	notifyVaultSchemaChanged,
	prepareDuplicatedNote,
	removeNotePropertiesUiState,
	renameNotePropertiesUiState,
} from "@cortex/properties"
import { getSettingsManager, useSettingsStore } from "@cortex/settings"
import { formatTemplateDate } from "@cortex/templates"
import { create } from "zustand"
import { moveLocalHistory } from "../history/localHistory"
import { noteCache } from "../noteCache"
import { ensureVaultOnboardingNote } from "../onboarding/vaultOnboarding"
import { pathExists, resolveUniquePath, writeCleanNote } from "../utils/createdNote"
import { getPortableFileNameError } from "../utils/fileName"
import { createDefaultFrontmatter } from "../utils/frontmatter"
import { assertVaultPathWritable, assertVaultTreeWritable, useAccessStore } from "./accessStore"
import { useBookmarksStore } from "./bookmarksStore"
import { useCommentsStore } from "./commentsStore"
import { useDatabaseStore } from "./databaseStore"
import { useSyncStore } from "./syncStore"
import { useTemplateStore } from "./templateStore"
import { setVaultRuntimeState } from "./vaultRuntime"
import { useWorkspaceStore } from "./workspaceStore"

export type { VaultMetadata, VaultRegistryEntry }

export interface VaultFileChange {
	path: string
	kind: WatchEvent["kind"]
}

type VaultFileChangeListener = (changes: VaultFileChange[]) => void

const WATCHER_BATCH_DELAY_MS = 200

const vaultFileChangeListeners = new Set<VaultFileChangeListener>()
const pendingWatchEvents = new Map<string, WatchEvent["kind"]>()
let watcherBatchTimer: ReturnType<typeof setTimeout> | null = null
let watcherBatchQueue: Promise<void> = Promise.resolve()
let watcherGeneration = 0

export interface OpenVaultOptions {
	icon?: string
	name?: string
	color?: string
	createOnboardingNote?: boolean
}

export function subscribeVaultFileChanges(listener: VaultFileChangeListener): () => void {
	vaultFileChangeListeners.add(listener)
	return () => vaultFileChangeListeners.delete(listener)
}

function isHiddenVaultPath(path: string, vaultPath: string): boolean {
	const relativePath = toVaultRelativePath(path, vaultPath)
	return relativePath === null || relativePath.split("/").some((segment) => segment.startsWith("."))
}

function removeDeletedEntries(files: FileEntry[], deletedPaths: string[]): FileEntry[] {
	if (deletedPaths.length === 0) return files
	const nextFiles = files.filter(
		(file) => !deletedPaths.some((deletedPath) => isPathOrDescendant(file.path, deletedPath)),
	)
	return nextFiles.length === files.length ? files : nextFiles
}

function scheduleWatcherBatch(processBatch: (changes: VaultFileChange[]) => Promise<void>): void {
	if (watcherBatchTimer) clearTimeout(watcherBatchTimer)
	const generation = watcherGeneration
	watcherBatchTimer = setTimeout(() => {
		watcherBatchTimer = null
		const changes = Array.from(pendingWatchEvents, ([path, kind]) => ({ path, kind }))
		pendingWatchEvents.clear()
		watcherBatchQueue = watcherBatchQueue
			.then(() => (generation === watcherGeneration ? processBatch(changes) : undefined))
			.catch((error) => console.error("[Vault watcher batch failed]", { error }))
	}, WATCHER_BATCH_DELAY_MS)
}

function clearWatcherBatch(): void {
	if (watcherBatchTimer) clearTimeout(watcherBatchTimer)
	watcherBatchTimer = null
	pendingWatchEvents.clear()
	watcherGeneration += 1
}

function notifyVaultFileChanges(changes: VaultFileChange[]): void {
	if (changes.length === 0) return
	for (const listener of vaultFileChangeListeners) listener(changes)
}

async function writeCleanNoteAndRefreshFiles(
	filePath: string,
	content: string,
	refreshFiles: () => Promise<void>,
): Promise<void> {
	await writeCleanNote(filePath, content)
	await refreshFiles()
}

async function createDailyNoteContent(
	vault: VaultMetadata,
	filePath: string,
	now: Date,
	templateId: string,
): Promise<string> {
	const title = splitExtension(getBaseName(filePath)).baseName
	if (templateId) {
		const preview = await useTemplateStore
			.getState()
			.previewNoteFromTemplate(vault, {
				templateId,
				noteTitle: title,
				targetFolder: toVaultRelativePath(getParentPath(filePath), vault.path) ?? "",
				fileName: getBaseName(filePath),
				now,
			})
			.catch(() => null)
		if (preview) return preview.content
	}
	const content = await createNoteWithPropertyDefaults(
		vault.path,
		createDefaultFrontmatter({
			tags: ["daily"],
			extraFields: { date: formatTemplateDate(now, "yyyy-MM-dd") },
		}),
	)
	return `${content}\n# ${title}\n\n`
}

function resolveDailyNotePath(vaultPath: string, now: Date): string {
	const { folder, format } = useSettingsStore.getState().settings.dailyNotes
	const folderPath = folder.replace(/^\/+|\/+$/gu, "")
	const directory = folderPath ? joinPath(vaultPath, folderPath) : vaultPath
	return ensureMarkdownExtension(joinPath(directory, formatTemplateDate(now, format)))
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
	await useCommentsStore.getState().moveNoteComments(vaultPath, oldPath, newPath)
	await moveLocalHistory(vaultPath, oldPath, newPath)
	if (getOptionalPropertiesRuntime()) {
		await renameNotePropertiesUiState(vaultPath, oldPath, newPath)
	}
}

async function renameDatabaseViewNote(
	vaultPath: string,
	oldFolderPath: string,
	newFolderPath: string,
): Promise<void> {
	if (!useDatabaseStore.getState().databases[normalizePath(oldFolderPath)]) return
	const movedNotePath = joinPath(newFolderPath, `${getBaseName(oldFolderPath)}.md`)
	const renamedNotePath = joinPath(newFolderPath, `${getBaseName(newFolderPath)}.md`)
	if (movedNotePath === renamedNotePath || (await pathExists(renamedNotePath))) return
	try {
		await getPlatform().fs.renameFile(movedNotePath, renamedNotePath)
		await migrateVaultPathReferences(vaultPath, movedNotePath, renamedNotePath)
	} catch (error) {
		console.error("[Database view note rename failed]", { path: movedNotePath, error })
	}
}

async function loadVaultConfiguration(metadata: VaultMetadata): Promise<void> {
	await Promise.all([
		useSettingsStore.getState().loadSettings(metadata.path),
		useBookmarksStore.getState().loadBookmarks(metadata.path),
		useSyncStore.getState().loadSyncPreferences(metadata.path),
		useTemplateStore.getState().loadTemplates(metadata),
	])
}

async function createOnboardingNote(vaultPath: string): Promise<string | null> {
	try {
		return (await ensureVaultOnboardingNote(vaultPath)).notePath
	} catch (error) {
		console.error("[Vault onboarding note creation failed]", { vaultPath, error })
		return null
	}
}

async function refreshOpenNote(filePath: string): Promise<void> {
	try {
		const hash = await getPlatform().fs.hashFile(filePath)
		await noteCache.handleExternalChange(filePath, hash)
	} catch (error) {
		console.error("[Vault file change failed]", { path: filePath, error })
	}
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
	switchVault: (path: string, options?: OpenVaultOptions) => Promise<void>
	resolveFolderOpen: (folderPath: string) => VaultRegistryEntry | null
	loadVaultSnapshot: (path: string) => Promise<void>
	closeVault: () => Promise<void>
	refreshFiles: () => Promise<void>
	loadRecentVaults: () => Promise<void>
	clearPendingOnboardingNotePath: () => void
	removeRecentVault: (uuid: string) => Promise<void>
	patchRecentVault: (uuid: string, patch: VaultRegistryPatch) => Promise<void>
	createFile: (parentPath: string, name: string) => Promise<string>
	createFileWithContent: (parentPath: string, name: string, content: string) => Promise<string>
	createFolder: (parentPath: string, name: string) => Promise<string>
	deleteFile: (filePath: string) => Promise<void>
	renameFile: (oldPath: string, newName: string) => Promise<string>
	moveFile: (oldPath: string, targetParentPath: string) => Promise<string>
	duplicateFile: (filePath: string) => Promise<string>
	openDailyNote: () => Promise<string | null>
}

export const useVaultStore = create<VaultState>((set, get) => {
	const processWatcherBatch = async (changes: VaultFileChange[]): Promise<void> => {
		const { vault, files } = get()
		if (!vault) return
		const createdPaths = changes.flatMap((change) =>
			change.kind === "created" || change.kind === "renamed" ? [change.path] : [],
		)
		const knownPaths = createdPaths.length > 0 ? new Set(files.map((file) => file.path)) : null
		if (knownPaths) {
			changes = changes.map((change) =>
				change.kind === "created" && knownPaths.has(change.path)
					? { ...change, kind: "modified" }
					: change,
			)
		}
		if (knownPaths && createdPaths.some((path) => !knownPaths.has(path))) {
			await get().refreshFiles()
		} else {
			const deletedPaths = changes.flatMap((change) =>
				change.kind === "deleted" ? [change.path] : [],
			)
			const nextFiles = removeDeletedEntries(files, deletedPaths)
			if (nextFiles !== files) set({ files: nextFiles })
		}
		if (get().vault === vault) notifyVaultFileChanges(changes)
	}

	const handleWatchEvent = (vaultPath: string, event: WatchEvent): void => {
		if (toVaultRelativePath(event.path, vaultPath) === VAULT_FILES.propertySchema) {
			notifyVaultSchemaChanged(vaultPath)
		} else if (isMarkdownPath(event.path)) {
			invalidatePropertySuggestions(vaultPath)
		}
		if ((event.kind === "created" || event.kind === "modified") && noteCache.getEntry(event.path)) {
			void refreshOpenNote(event.path)
		}
		if (isHiddenVaultPath(event.path, vaultPath)) return
		pendingWatchEvents.set(normalizePath(event.path), event.kind)
		scheduleWatcherBatch(processWatcherBatch)
	}

	return {
		vault: null,
		files: [],
		recentVaults: [],
		loading: false,
		error: null,
		stopWatcher: null,
		pendingOnboardingNotePath: null,

		openVault: async (path, options) => {
			const platform = getPlatform()
			if ((await platform.window.claimVault(path)) === "focused-owner") return
			set({ loading: true, error: null, pendingOnboardingNotePath: null })
			try {
				const metadata = await platform.vault.openVault(path)
				const pendingOnboardingNotePath = options?.createOnboardingNote
					? await createOnboardingNote(metadata.path)
					: null
				const [files] = await Promise.all([
					platform.vault.scanVault(metadata.path),
					platform.vault
						.updateVaultRegistry(
							metadata.uuid,
							metadata.path,
							options?.name ?? metadata.name,
							options?.icon,
						)
						.then(() =>
							options?.color
								? platform.vault.patchVaultRegistry?.(metadata.uuid, { color: options.color })
								: undefined,
						),
					loadVaultConfiguration(metadata),
				])
				const stopWatcher = await platform.fs.startWatching(metadata.path, (event) =>
					handleWatchEvent(metadata.path, event),
				)

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
				if (!get().vault) await platform.window.releaseVault()
			}
		},

		switchVault: async (path, options) => {
			if (get().vault?.path === path) return
			if ((await getPlatform().window.claimVault(path)) === "focused-owner") return
			await get().closeVault()
			await get().openVault(path, options)
		},

		resolveFolderOpen: (folderPath) => {
			const normalizedFolderPath = normalizePath(folderPath)
			return (
				get().recentVaults.find((entry) => normalizePath(entry.path) === normalizedFolderPath) ??
				null
			)
		},

		loadVaultSnapshot: async (path) => {
			const platform = getPlatform()
			set({ loading: true, error: null })
			try {
				const metadata = await platform.vault.openVault(path)
				const [files] = await Promise.all([
					platform.vault.scanVault(metadata.path),
					loadVaultConfiguration(metadata),
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
			const { stopWatcher, vault } = get()
			stopWatcher?.()
			clearWatcherBatch()
			useAccessStore.getState().resetAccess()
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
			if (vault) await getPlatform().window.releaseVault()
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
				set({ recentVaults: sortRecentVaults(entries) })
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

		patchRecentVault: async (uuid, patch) => {
			const vault = getPlatform().vault
			if (!vault.patchVaultRegistry) return
			await vault.patchVaultRegistry(uuid, patch)
			await get().loadRecentVaults()
		},

		createFile: async (parentPath, name) => {
			const fileName = ensureMarkdownExtension(name)
			const validationError = getPortableFileNameError(fileName)
			if (validationError) throw new Error(validationError)
			assertVaultPathWritable(parentPath, true)
			const vaultPath = get().vault?.path
			const [filePath, content] = await Promise.all([
				resolveUniquePath(parentPath, fileName),
				createNoteWithPropertyDefaults(vaultPath ?? parentPath, createDefaultFrontmatter()),
			])
			await writeCleanNoteAndRefreshFiles(filePath, content, get().refreshFiles)
			invalidatePropertySuggestions(vaultPath)
			return filePath
		},

		createFileWithContent: async (parentPath, name, content) => {
			const fileName = ensureMarkdownExtension(name)
			const validationError = getPortableFileNameError(fileName)
			if (validationError) throw new Error(validationError)
			assertVaultPathWritable(parentPath, true)
			const filePath = await resolveUniquePath(parentPath, fileName)
			await writeCleanNoteAndRefreshFiles(filePath, content, get().refreshFiles)
			return filePath
		},

		createFolder: async (parentPath, name) => {
			const platform = getPlatform()
			const validationError = getPortableFileNameError(name)
			if (validationError) throw new Error(validationError)
			assertVaultPathWritable(parentPath, true)
			const folderPath = await resolveUniquePath(parentPath, name)
			await platform.fs.createDir(folderPath)
			await get().refreshFiles()
			return folderPath
		},

		deleteFile: async (filePath) => {
			const platform = getPlatform()
			const vaultPath = get().vault?.path
			const deletedEntry = get().files.find((file) => file.path === filePath)
			assertVaultTreeWritable(filePath, deletedEntry?.isDir ?? false)
			await platform.fs.deleteFile(filePath)
			noteCache.forget(filePath, { descendants: deletedEntry?.isDir ?? false })
			useWorkspaceStore.getState().closeTabsByPath(filePath)
			await Promise.all([
				vaultPath
					? useBookmarksStore.getState().removeBookmarksUnderPath(vaultPath, filePath)
					: undefined,
				vaultPath && getOptionalPropertiesRuntime()
					? removeNotePropertiesUiState(vaultPath, filePath)
					: undefined,
				vaultPath ? useCommentsStore.getState().removeNoteComments(vaultPath, filePath) : undefined,
				get().refreshFiles(),
			])
			if (vaultPath && isMarkdownPath(filePath)) invalidatePropertySuggestions(vaultPath)
		},

		renameFile: async (oldPath, newName) => {
			const platform = getPlatform()
			const validationError = getPortableFileNameError(newName)
			if (validationError) throw new Error(validationError)
			const newPath = joinPath(getParentPath(oldPath), newName)
			if (oldPath === newPath) return oldPath

			const files = get().files
			assertVaultTreeWritable(oldPath, files.find((file) => file.path === oldPath)?.isDir ?? false)
			const databaseActions = await import("../runtime/databaseActions")
			await databaseActions.flushDatabaseConfigWrites()
			await flushAffectedNotes(files, oldPath)
			await platform.fs.renameFile(oldPath, newPath)
			const vaultPath = get().vault?.path
			if (vaultPath) await migrateVaultPathReferences(vaultPath, oldPath, newPath)
			if (vaultPath) await renameDatabaseViewNote(vaultPath, oldPath, newPath)
			if (isMarkdownPath(oldPath)) databaseActions.renameDatabaseRowOrder(oldPath, newPath)
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

			const normalizedTargetParent = normalizePath(targetParentPath)
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
			assertVaultTreeWritable(oldPath, sourceEntry.isDir)
			assertVaultPathWritable(normalizedTargetParent, true)

			const newPath = joinPath(normalizedTargetParent, getBaseName(oldPath))
			if (newPath === oldPath) return oldPath
			if (files.some((file) => file.path === newPath)) {
				throw new Error("Destination already exists")
			}

			const { flushDatabaseConfigWrites } = await import("../runtime/databaseActions")
			await flushDatabaseConfigWrites()
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
			assertVaultPathWritable(parentPath, true)
			const { baseName, extension } = splitExtension(getBaseName(filePath))
			const vaultPath = get().vault?.path
			const [newPath, content] = await Promise.all([
				resolveUniquePath(parentPath, `${baseName} (copy)${extension}`),
				getPlatform().fs.readFile(filePath),
			])
			const duplicatedContent = vaultPath
				? await prepareDuplicatedNote(vaultPath, content)
				: content
			await writeCleanNoteAndRefreshFiles(newPath, duplicatedContent, get().refreshFiles)
			if (vaultPath && isMarkdownPath(newPath)) invalidatePropertySuggestions(vaultPath)
			return newPath
		},

		openDailyNote: async () => {
			const { vault, files } = get()
			if (!vault) return null

			const now = new Date()
			const filePath = resolveDailyNotePath(vault.path, now)
			if (files.some((file) => file.path === filePath)) return filePath
			if (await pathExists(filePath)) return filePath

			const dailyDir = getParentPath(filePath)
			const dailyDirExists =
				dailyDir === vault.path || files.some((file) => file.isDir && file.path === dailyDir)
			assertVaultPathWritable(dailyDirExists ? dailyDir : vault.path, true)
			const { templateId } = useSettingsStore.getState().settings.dailyNotes
			const [content] = await Promise.all([
				createDailyNoteContent(vault, filePath, now, templateId),
				dailyDirExists ? Promise.resolve() : getPlatform().fs.createDir(dailyDir),
			])
			await writeCleanNoteAndRefreshFiles(filePath, content, get().refreshFiles)
			invalidatePropertySuggestions(vault.path)
			return filePath
		},
	}
})

useVaultStore.subscribe((state) => {
	setVaultRuntimeState(state.vault?.path ?? null, state.refreshFiles)
})

const initialVaultState = useVaultStore.getState()
setVaultRuntimeState(initialVaultState.vault?.path ?? null, initialVaultState.refreshFiles)
