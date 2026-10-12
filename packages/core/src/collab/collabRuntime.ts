import type {
	CollabNoteDocument,
	CollabRegistry,
	CollabRegistryEntry,
	CollabRoom,
	CollabSessionSnapshot,
	CollabSessionUser,
} from "@cortex/collab"
import { MAX_COLLAB_NOTE_BYTES } from "@cortex/collab/constants"
import { type CollabAvailability, getPlatform } from "@cortex/platform"
import { isMarkdownPath, toVaultRelativePath } from "@cortex/platform/utils"
import { noteCache } from "../noteCache"
import { canReadVaultPath } from "../stores/accessStore"
import { useAccountStore } from "../stores/accountStore"
import { useAuthStore } from "../stores/authStore"
import { useRemoteVaultStore } from "../stores/remoteVaultStore"
import { useSyncLogStore } from "../stores/syncLogStore"
import { useVaultStore } from "../stores/vaultStore"
import { splitNoteParts } from "./noteParts"

export interface CollabNoteBinding {
	text: CollabNoteDocument["body"]
	awareness: CollabNoteDocument["awareness"]
	undoManager: CollabNoteDocument["undoManager"]
}

export interface CollabNoteState {
	binding: CollabNoteBinding | null
	snapshot: CollabSessionSnapshot
}

interface CachedNoteState {
	snapshot: CollabSessionSnapshot
	state: CollabNoteState
}

interface CollabContext {
	vaultPath: string
	vaultId: string
}

const listeners = new Set<() => void>()
const availabilityLoads = new Map<string, Promise<CollabAvailability>>()
const noteStates = new WeakMap<CollabRegistryEntry, CachedNoteState>()
const bindings = new WeakMap<CollabNoteDocument, CollabNoteBinding>()
let registry: CollabRegistry | null = null
let registryLoad: Promise<CollabRegistry> | null = null
let runtimeActive = false
let contextKey = ""

function notifyCollabListeners(): void {
	for (const listener of listeners) listener()
}

function resolveCollabContext(): CollabContext | null {
	const vaultPath = useVaultStore.getState().vault?.path
	const { linkedVaultId, syncConfig } = useRemoteVaultStore.getState()
	if (!vaultPath || !linkedVaultId || !syncConfig.enabled || syncConfig.offlineMode) return null
	if (!useAuthStore.getState().user) return null
	return { vaultPath, vaultId: linkedVaultId }
}

function resolveCollabRoom(filePath: string): CollabRoom | null {
	const context = resolveCollabContext()
	if (!context) return null
	const roomPath = toVaultRelativePath(filePath, context.vaultPath)
	return roomPath ? { vaultId: context.vaultId, roomPath } : null
}

function resolveCollabUser(): CollabSessionUser | null {
	const user = useAuthStore.getState().user
	if (!user) return null
	const profile = useAccountStore.getState().profile
	return {
		id: user.userId,
		name: user.displayName || user.email,
		avatarUrl: profile?.userId === user.userId ? profile.avatarUrl : null,
	}
}

function readLocalParts(filePath: string) {
	const entry = noteCache.getEntry(filePath)
	return entry ? splitNoteParts(entry.content) : null
}

function takeCollabSnapshot(filePath: string): void {
	if (!noteCache.takeSnapshot(filePath, "pre-sync")) return
	useSyncLogStore
		.getState()
		.log("warn", "Live session replaced unsynced local changes; a snapshot was kept", {
			path: filePath,
		})
}

function loadCollabAvailability(vaultId: string): Promise<CollabAvailability> {
	let load = availabilityLoads.get(vaultId)
	if (!load) {
		load = getPlatform()
			.collab.availability(vaultId)
			.catch((): CollabAvailability => "unsupported")
		availabilityLoads.set(vaultId, load)
	}
	return load
}

function loadCollabRegistry(): Promise<CollabRegistry> {
	registryLoad ??= Promise.all([import("@cortex/collab"), import("./collabPersistence")]).then(
		([collabModule, persistenceModule]) => {
			const loadedRegistry = collabModule.createCollabRegistry({
				collab: getPlatform().collab,
				resolveRoom: resolveCollabRoom,
				resolveUser: resolveCollabUser,
				fileSync: true,
				readLocalParts,
				hasUnsyncedLocalChanges: (filePath) => noteCache.isDirty(filePath),
				takeSnapshot: takeCollabSnapshot,
				attach: (entry) => {
					const detachPersistence = persistenceModule.attachCollabPersistence(entry)
					const unsubscribe = entry.session.subscribe(notifyCollabListeners)
					return () => {
						unsubscribe()
						detachPersistence()
					}
				},
			})
			loadedRegistry.subscribe(notifyCollabListeners)
			registry = loadedRegistry
			return loadedRegistry
		},
	)
	return registryLoad
}

function resolveEligibleContext(filePath: string): CollabContext | null {
	if (!runtimeActive || !isMarkdownPath(filePath)) return null
	const context = resolveCollabContext()
	return context && canReadVaultPath(filePath) ? context : null
}

function fitsCollabLimit(content: string): boolean {
	return new TextEncoder().encode(content).length <= MAX_COLLAB_NOTE_BYTES
}

export function retainCollabNote(filePath: string): () => void {
	let released = false
	let retained: CollabRegistryEntry | null = null
	const retain = async () => {
		const context = resolveEligibleContext(filePath)
		if (!context) return
		const [availability, entry] = await Promise.all([
			loadCollabAvailability(context.vaultId),
			noteCache.readEntry(filePath),
		])
		if (released || availability !== "ready" || !fitsCollabLimit(entry.content)) return
		const loadedRegistry = await loadCollabRegistry()
		if (released || !resolveEligibleContext(filePath)) return
		retained = loadedRegistry.retain(filePath)
	}
	void retain().catch(() => {})
	return () => {
		released = true
		if (retained) registry?.release(retained)
		retained = null
	}
}

export function subscribeCollabNotes(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getCollabBinding(noteDocument: CollabNoteDocument): CollabNoteBinding {
	let binding = bindings.get(noteDocument)
	if (!binding) {
		binding = {
			text: noteDocument.body,
			awareness: noteDocument.awareness,
			undoManager: noteDocument.undoManager,
		}
		bindings.set(noteDocument, binding)
	}
	return binding
}

export function getCollabNoteState(filePath: string): CollabNoteState | null {
	const entry = registry?.get(filePath)
	if (!entry) return null
	const snapshot = entry.session.getSnapshot()
	const cached = noteStates.get(entry)
	if (cached?.snapshot === snapshot) return cached.state
	const bound = snapshot.ready && snapshot.status !== "unavailable" && snapshot.status !== "closed"
	const state: CollabNoteState = {
		binding: bound ? getCollabBinding(entry.noteDocument) : null,
		snapshot,
	}
	noteStates.set(entry, { snapshot, state })
	return state
}

function readContextKey(): string {
	const vaultPath = useVaultStore.getState().vault?.path ?? ""
	const { linkedVaultId, syncConfig } = useRemoteVaultStore.getState()
	const userId = useAuthStore.getState().user?.userId ?? ""
	return [
		vaultPath,
		linkedVaultId ?? "",
		syncConfig.enabled,
		syncConfig.offlineMode,
		syncConfig.serverUrl ?? "",
		userId,
	].join("\u0000")
}

function handleContextChange(): void {
	const nextKey = readContextKey()
	if (nextKey === contextKey) return
	contextKey = nextKey
	availabilityLoads.clear()
	registry?.closeAll()
}

export function startCollabRuntime(): () => void {
	runtimeActive = true
	contextKey = readContextKey()
	const unsubscribes = [
		useVaultStore.subscribe(handleContextChange),
		useRemoteVaultStore.subscribe(handleContextChange),
		useAuthStore.subscribe(handleContextChange),
		noteCache.onPathChange((oldPath, newPath) => {
			if (!registry) return
			if (newPath) registry.rename(oldPath, newPath)
			else registry.close(oldPath)
		}),
	]
	return () => {
		runtimeActive = false
		for (const unsubscribe of unsubscribes) unsubscribe()
		availabilityLoads.clear()
		registry?.closeAll()
	}
}
