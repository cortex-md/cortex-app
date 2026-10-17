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
	getContentFingerprint,
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
import { create } from "zustand"
import { moveLocalHistory } from "../history/localHistory"
import { noteCache } from "../noteCache"
import { ensureVaultOnboardingNote } from "../onboarding/vaultOnboarding"
import { formatTemplateDate } from "../templates"
import { pathExists, resolveUniquePath, writeCleanNote } from "../utils/createdNote"
import { getPortableFileNameError } from "../utils/fileName"
import { createDefaultFrontmatter } from "../utils/frontmatter"
import {
	isEmptyVaultIndexDelta,
	isStructuralVaultIndexDelta,
	VaultIndex,
	type VaultIndexChange,
	type VaultIndexDelta,
} from "../vault/vaultIndex"
import { closeVaultStateFiles } from "../vault/vaultStateFiles"
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
	entry?: FileEntry
}

type VaultFileChangeListener = (changes: VaultFileChange[]) => void
type VaultIndexListener = (delta: VaultIndexDelta) => void

const WATCHER_BATCH_DELAY_MS = 200

const vaultFileChangeListeners = new Set<VaultFileChangeListener>()
const vaultIndexListeners = new Set<VaultIndexListener>()
let vaultIndex = new VaultIndex("")
let indexedFiles: readonly FileEntry[] = vaultIndex.getFiles()
const pendingWatchEvents = new Map<string, WatchEvent>()
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

export function subscribeVaultIndexChanges(listener: VaultIndexListener): () => void {
	vaultIndexListeners.add(listener)
	return () => vaultIndexListeners.delete(listener)
}

function createVaultIndex(rootPath: string, files: readonly FileEntry[]): VaultIndex {
	const index = new VaultIndex(rootPath, files)
	index.setDatabaseViewNotes(useDatabaseStore.getState().viewNotePaths)
	return index
}

export function getVaultIndex(): VaultIndex {
	const { vault, files } = useVaultStore.getState()
	const rootPath = normalizePath(vault?.path ?? "")
	if (vaultIndex.rootPath !== rootPath || files !== indexedFiles) {
		vaultIndex = createVaultIndex(rootPath, files)
		indexedFiles = files
	}
	return vaultIndex
}

function resetVaultIndex(rootPath: string, files: readonly FileEntry[]) {
	vaultIndex = createVaultIndex(rootPath, files)
	indexedFiles = vaultIndex.getFiles()
	return {
		files: vaultIndex.getFiles(),
		fileTreeVersion: vaultIndex.treeVersion,
		fileEntryVersion: vaultIndex.entryVersion,
	}
}

function findScanRoot(index: VaultIndex, path: string): string {
	let current = normalizePath(path)
	while (current && current !== index.rootPath && !index.isFolder(current)) {
		const parent = getParentPath(current)
		if (parent === current) break
		current = parent
	}
	return current || index.rootPath
}

function commitVaultIndexDelta(index: VaultIndex, delta: VaultIndexDelta): void {
	if (index !== vaultIndex) return
	if (!isEmptyVaultIndexDelta(delta)) {
		if (isStructuralVaultIndexDelta(delta)) indexedFiles = index.getFiles()
		useVaultStore.setState((state) => ({
			files: isStructuralVaultIndexDelta(delta) ? index.getFiles() : state.files,
			fileTreeVersion: index.treeVersion,
			fileEntryVersion: index.entryVersion,
		}))
		for (const listener of vaultIndexListeners) listener(delta)
	}
	const scanRoots = new Set(delta.missingParents.map((path) => findScanRoot(index, path)))
	for (const root of scanRoots) void useVaultStore.getState().scanFolder(root)
}

function collectNewFolderRoots(delta: VaultIndexDelta): string[] {
	const folders = delta.added.flatMap((entry) => (entry.isDir ? [entry.path] : []))
	return folders.filter(
		(folder) => !folders.some((other) => other !== folder && isPathOrDescendant(folder, other)),
	)
}

function createdFileEntry(filePath: string, content: string): FileEntry {
	const modifiedAt = noteCache.getEntry(filePath)?.metadata?.modifiedAt ?? Date.now()
	return {
		path: normalizePath(filePath),
		name: getBaseName(filePath),
		isDir: false,
		...getContentFingerprint(content, modifiedAt),
	}
}

function createdFolderEntry(folderPath: string): FileEntry {
	return {
		path: normalizePath(folderPath),
		name: getBaseName(folderPath),
		isDir: true,
		mtime: Math.floor(Date.now() / 1000),
		size: 0,
	}
}

export function trackCreatedFiles(
	notePaths: readonly string[],
	folderPaths: readonly string[] = [],
): void {
	useVaultStore.getState().applyFileChanges([
		...folderPaths.map(
			(path): VaultIndexChange => ({ kind: "upsert", entry: createdFolderEntry(path) }),
		),
		...notePaths.map(
			(path): VaultIndexChange => ({
				kind: "upsert",
				entry: createdFileEntry(path, noteCache.getEntry(path)?.content ?? ""),
			}),
		),
	])
}

function isHiddenVaultPath(path: string, vaultPath: string): boolean {
	const relativePath = toVaultRelativePath(path, vaultPath)
	return relativePath === null || relativePath.split("/").some((segment) => segment.startsWith("."))
}

function scheduleWatcherBatch(processBatch: (changes: VaultFileChange[]) => Promise<void>): void {
	if (watcherBatchTimer) clearTimeout(watcherBatchTimer)
	const generation = watcherGeneration
	watcherBatchTimer = setTimeout(() => {
		watcherBatchTimer = null
		const changes = Array.from(pendingWatchEvents, ([path, event]) => ({
			path,
			kind: event.kind,
			entry: event.entry ? { ...event.entry, path } : undefined,
		}))
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

async function writeCleanNoteAndTrack(
	filePath: string,
	content: string,
	extraChanges: VaultIndexChange[] = [],
): Promise<void> {
	await writeCleanNote(filePath, content)
	useVaultStore
		.getState()
		.applyFileChanges([
			...extraChanges,
			{ kind: "upsert", entry: createdFileEntry(filePath, content) },
		])
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

function getAffectedNotePaths(oldPath: string): string[] {
	const index = getVaultIndex()
	if (!index.get(oldPath)?.isDir) return [oldPath]
	const paths = index.collectSubtree(oldPath).flatMap((file) => (file.isDir ? [] : [file.path]))
	return paths.length > 0 ? paths : [oldPath]
}

async function flushAffectedNotes(oldPath: string): Promise<void> {
	await Promise.all(getAffectedNotePaths(oldPath).map((path) => noteCache.flush(path)))
}

async function renameAfterFlushingAffectedNotes(
	oldPath: string,
	newPath: string,
): Promise<string[]> {
	const affectedNotePaths = getAffectedNotePaths(oldPath)
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
): Promise<VaultIndexChange | null> {
	if (!useDatabaseStore.getState().databases[normalizePath(oldFolderPath)]) return null
	const movedNotePath = joinPath(newFolderPath, `${getBaseName(oldFolderPath)}.md`)
	const renamedNotePath = joinPath(newFolderPath, `${getBaseName(newFolderPath)}.md`)
	if (movedNotePath === renamedNotePath || (await pathExists(renamedNotePath))) return null
	try {
		await getPlatform().fs.renameFile(movedNotePath, renamedNotePath)
		await migrateVaultPathReferences(vaultPath, movedNotePath, renamedNotePath)
		return { kind: "rename", from: movedNotePath, to: renamedNotePath }
	} catch (error) {
		console.error("[Database view note rename failed]", { path: movedNotePath, error })
		return null
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
	fileTreeVersion: number
	fileEntryVersion: number
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
	scanFolder: (folderPath: string) => Promise<void>
	applyFileChanges: (changes: readonly VaultIndexChange[]) => void
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
		const { vault } = get()
		if (!vault) return
		const index = getVaultIndex()
		changes = changes.map((change) =>
			change.kind === "created" && index.has(change.path)
				? { ...change, kind: "modified" }
				: change,
		)
		if (
			changes.some(
				(change) => (change.kind === "created" || change.kind === "renamed") && !change.entry,
			)
		) {
			await get().refreshFiles()
		} else {
			const patch: VaultIndexChange[] = []
			for (const change of changes) {
				if (change.kind === "deleted") patch.push({ kind: "remove", path: change.path })
				else if (change.entry && !isHiddenVaultPath(change.path, vault.path)) {
					patch.push({ kind: "upsert", entry: change.entry })
				}
			}
			const delta = index.apply(patch)
			commitVaultIndexDelta(index, delta)
			for (const folder of collectNewFolderRoots(delta)) void get().scanFolder(folder)
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
		pendingWatchEvents.set(normalizePath(event.path), event)
		scheduleWatcherBatch(processWatcherBatch)
	}

	return {
		vault: null,
		files: [],
		fileTreeVersion: 0,
		fileEntryVersion: 0,
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
					...resetVaultIndex(metadata.path, files),
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
					...resetVaultIndex(metadata.path, files),
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
			await Promise.all([
				getSettingsManager().flush(),
				vault ? closeVaultStateFiles(vault.path) : undefined,
			])
			useBookmarksStore.getState().reset()
			useTemplateStore.getState().reset()
			set({
				vault: null,
				...resetVaultIndex("", []),
				stopWatcher: null,
				error: null,
				pendingOnboardingNotePath: null,
			})
			if (vault) await getPlatform().window.releaseVault()
		},

		refreshFiles: async () => {
			const { vault } = get()
			if (!vault) return
			const index = getVaultIndex()
			try {
				const files = await getPlatform().vault.scanVault(vault.path)
				if (get().vault !== vault) return
				commitVaultIndexDelta(index, index.replaceAll(files))
			} catch (error) {
				console.error("[Vault refresh failed]", { vaultPath: vault.path, error })
				set({ error: String(error) })
			}
		},

		scanFolder: async (folderPath) => {
			const { vault } = get()
			if (!vault) return
			const folder = normalizePath(folderPath)
			if (folder === normalizePath(vault.path)) return get().refreshFiles()
			const index = getVaultIndex()
			try {
				const entries = await getPlatform().vault.scanVault(folder)
				if (get().vault !== vault) return
				const descendants = entries.filter(
					(entry) =>
						isPathOrDescendant(entry.path, folder) && !isHiddenVaultPath(entry.path, vault.path),
				)
				commitVaultIndexDelta(index, index.replaceSubtree(folder, descendants))
			} catch (error) {
				console.error("[Vault folder scan failed]", { folderPath: folder, error })
			}
		},

		applyFileChanges: (changes) => {
			if (changes.length === 0) return
			const index = getVaultIndex()
			commitVaultIndexDelta(index, index.apply(changes))
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
			await writeCleanNoteAndTrack(filePath, content)
			invalidatePropertySuggestions(vaultPath)
			return filePath
		},

		createFileWithContent: async (parentPath, name, content) => {
			const fileName = ensureMarkdownExtension(name)
			const validationError = getPortableFileNameError(fileName)
			if (validationError) throw new Error(validationError)
			assertVaultPathWritable(parentPath, true)
			const filePath = await resolveUniquePath(parentPath, fileName)
			await writeCleanNoteAndTrack(filePath, content)
			return filePath
		},

		createFolder: async (parentPath, name) => {
			const platform = getPlatform()
			const validationError = getPortableFileNameError(name)
			if (validationError) throw new Error(validationError)
			assertVaultPathWritable(parentPath, true)
			const folderPath = await resolveUniquePath(parentPath, name)
			await platform.fs.createDir(folderPath)
			get().applyFileChanges([{ kind: "upsert", entry: createdFolderEntry(folderPath) }])
			return folderPath
		},

		deleteFile: async (filePath) => {
			const platform = getPlatform()
			const vaultPath = get().vault?.path
			const deletedEntry = getVaultIndex().get(filePath)
			assertVaultTreeWritable(filePath, deletedEntry?.isDir ?? false)
			await platform.fs.deleteFile(filePath)
			noteCache.forget(filePath, { descendants: deletedEntry?.isDir ?? false })
			useWorkspaceStore.getState().closeTabsByPath(filePath)
			get().applyFileChanges([{ kind: "remove", path: filePath }])
			await Promise.all([
				vaultPath
					? useBookmarksStore.getState().removeBookmarksUnderPath(vaultPath, filePath)
					: undefined,
				vaultPath && getOptionalPropertiesRuntime()
					? removeNotePropertiesUiState(vaultPath, filePath)
					: undefined,
				vaultPath ? useCommentsStore.getState().removeNoteComments(vaultPath, filePath) : undefined,
			])
			if (vaultPath && isMarkdownPath(filePath)) invalidatePropertySuggestions(vaultPath)
		},

		renameFile: async (oldPath, newName) => {
			const platform = getPlatform()
			const validationError = getPortableFileNameError(newName)
			if (validationError) throw new Error(validationError)
			const newPath = joinPath(getParentPath(oldPath), newName)
			if (oldPath === newPath) return oldPath

			const known = getVaultIndex().get(oldPath)
			assertVaultTreeWritable(oldPath, known?.isDir ?? false)
			const databaseActions = await import("../runtime/databaseActions")
			await databaseActions.flushDatabaseConfigWrites()
			await flushAffectedNotes(oldPath)
			await platform.fs.renameFile(oldPath, newPath)
			const vaultPath = get().vault?.path
			const changes: VaultIndexChange[] = [{ kind: "rename", from: oldPath, to: newPath }]
			if (vaultPath) await migrateVaultPathReferences(vaultPath, oldPath, newPath)
			const viewNoteRename = vaultPath
				? await renameDatabaseViewNote(vaultPath, oldPath, newPath)
				: null
			if (viewNoteRename) changes.push(viewNoteRename)
			if (isMarkdownPath(oldPath)) databaseActions.renameDatabaseRowOrder(oldPath, newPath)
			if (known) get().applyFileChanges(changes)
			else await get().refreshFiles()
			if (vaultPath && (isMarkdownPath(oldPath) || isMarkdownPath(newPath))) {
				invalidatePropertySuggestions(vaultPath)
			}
			return newPath
		},

		moveFile: async (oldPath, targetParentPath) => {
			const { vault } = get()
			if (!vault) throw new Error("No vault is open")
			if (oldPath === vault.path) throw new Error("The vault root cannot be moved")

			const index = getVaultIndex()
			const sourceEntry = index.get(oldPath)
			if (!sourceEntry) throw new Error("Source file or folder was not found")

			const normalizedTargetParent = normalizePath(targetParentPath)
			if (!isPathOrDescendant(normalizedTargetParent, vault.path)) {
				throw new Error("Destination must be inside the current vault")
			}
			if (normalizedTargetParent !== vault.path && !index.isFolder(normalizedTargetParent)) {
				throw new Error("Destination folder was not found")
			}
			if (sourceEntry.isDir && isPathOrDescendant(normalizedTargetParent, oldPath)) {
				throw new Error("A folder cannot be moved into itself")
			}
			assertVaultTreeWritable(oldPath, sourceEntry.isDir)
			assertVaultPathWritable(normalizedTargetParent, true)

			const newPath = joinPath(normalizedTargetParent, getBaseName(oldPath))
			if (newPath === oldPath) return oldPath
			if (index.has(newPath)) {
				throw new Error("Destination already exists")
			}

			const { flushDatabaseConfigWrites } = await import("../runtime/databaseActions")
			await flushDatabaseConfigWrites()
			const affectedNotePaths = await renameAfterFlushingAffectedNotes(oldPath, newPath)
			get().applyFileChanges([{ kind: "rename", from: oldPath, to: newPath }])
			await migrateVaultPathReferences(vault.path, oldPath, newPath)
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
			await writeCleanNoteAndTrack(newPath, duplicatedContent)
			if (vaultPath && isMarkdownPath(newPath)) invalidatePropertySuggestions(vaultPath)
			return newPath
		},

		openDailyNote: async () => {
			const { vault } = get()
			if (!vault) return null

			const index = getVaultIndex()
			const now = new Date()
			const filePath = resolveDailyNotePath(vault.path, now)
			if (index.has(filePath)) return filePath
			if (await pathExists(filePath)) return filePath

			const dailyDir = getParentPath(filePath)
			const dailyDirExists = dailyDir === vault.path || index.isFolder(dailyDir)
			assertVaultPathWritable(dailyDirExists ? dailyDir : vault.path, true)
			const { templateId } = useSettingsStore.getState().settings.dailyNotes
			const [content] = await Promise.all([
				createDailyNoteContent(vault, filePath, now, templateId),
				dailyDirExists ? Promise.resolve() : getPlatform().fs.createDir(dailyDir),
			])
			await writeCleanNoteAndTrack(
				filePath,
				content,
				dailyDirExists ? [] : [{ kind: "upsert", entry: createdFolderEntry(dailyDir) }],
			)
			invalidatePropertySuggestions(vault.path)
			return filePath
		},
	}
})

useVaultStore.subscribe((state) => {
	setVaultRuntimeState(state.vault?.path ?? null, state.refreshFiles)
})

useDatabaseStore.subscribe((state, previous) => {
	if (state.viewNotePaths === previous.viewNotePaths) return
	const index = getVaultIndex()
	commitVaultIndexDelta(index, index.setDatabaseViewNotes(state.viewNotePaths))
})

const initialVaultState = useVaultStore.getState()
setVaultRuntimeState(initialVaultState.vault?.path ?? null, initialVaultState.refreshFiles)
