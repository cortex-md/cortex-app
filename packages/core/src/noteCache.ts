import { type FileMetadata, getPlatform } from "@cortex/platform"
import { prepareNoteForSave } from "@cortex/properties"

export type SnapshotTrigger = "auto" | "manual" | "pre-save" | "pre-sync"

export interface Snapshot {
	timestamp: number
	content: string
	trigger: SnapshotTrigger
}

export interface NoteCacheEntry {
	filePath: string
	content: string
	diskContent: string
	mtime: number
	hash: string
	metadata?: FileMetadata
	dirty: boolean
	lastAccessed: number
	openTabCount: number
	snapshots: Snapshot[]
	localCreatedAt?: number
}

export type ExternalChangeKind = "overwrite" | "conflict"

export interface ExternalChangeEvent {
	filePath: string
	kind: ExternalChangeKind
	snapshot: Snapshot
}

type ExternalChangeListener = (event: ExternalChangeEvent) => void
type ContentChangeListener = (filePath: string, content: string) => void

interface ExternalChangeLoad {
	latestHash: string
	promise: Promise<void>
}

interface PendingEntryLoad {
	version: number
	promise: Promise<NoteCacheEntry>
}

const EVICTION_IDLE_MS = 15 * 60 * 1000
const EVICTION_INTERVAL_MS = 5 * 60 * 1000
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000
const SNAPSHOT_MAX_PER_FILE = 50
const SNAPSHOT_RETENTION_DAYS = 30
const AUTOSAVE_DEBOUNCE_MS = 2000

function replacePathPrefix(path: string, oldPath: string, newPath: string): string | null {
	if (path === oldPath) return newPath
	if (!path.startsWith(`${oldPath}/`)) return null
	return `${newPath}${path.slice(oldPath.length)}`
}

class NoteCache {
	private entries = new Map<string, NoteCacheEntry>()
	private saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
	private snapshotTimers = new Map<string, ReturnType<typeof setInterval>>()
	private externalChangeListeners: ExternalChangeListener[] = []
	private contentChangeListeners = new Map<string, Set<ContentChangeListener>>()
	private externalChangeLoads = new Map<string, ExternalChangeLoad>()
	private entryLoads = new Map<string, PendingEntryLoad>()
	private pendingOpenTabCounts = new Map<string, number>()
	private loadVersions = new Map<string, number>()
	private evictionTimer: ReturnType<typeof setInterval> | null = null

	start() {
		this.evictionTimer = setInterval(() => this.runEviction(), EVICTION_INTERVAL_MS)
	}

	stop() {
		if (this.evictionTimer) {
			clearInterval(this.evictionTimer)
			this.evictionTimer = null
		}
		for (const timer of this.saveTimers.values()) clearTimeout(timer)
		for (const timer of this.snapshotTimers.values()) clearInterval(timer)
		this.saveTimers.clear()
		this.snapshotTimers.clear()
	}

	async read(filePath: string): Promise<string> {
		return (await this.readEntry(filePath)).content
	}

	async readEntry(filePath: string): Promise<NoteCacheEntry> {
		return this.loadEntry(filePath)
	}

	private loadEntry(filePath: string): Promise<NoteCacheEntry> {
		const entry = this.entries.get(filePath)
		if (entry) {
			entry.lastAccessed = Date.now()
			return Promise.resolve(entry)
		}
		const activeLoad = this.entryLoads.get(filePath)
		if (activeLoad) return activeLoad.promise

		const platform = getPlatform()
		const version = this.loadVersions.get(filePath) ?? 0
		const loadPromise = platform.fs.readFileSnapshot(filePath).then((snapshot) => {
			const now = Date.now()
			const loadedEntry: NoteCacheEntry = {
				filePath,
				content: snapshot.content,
				diskContent: snapshot.content,
				mtime: snapshot.metadata.modifiedAt,
				hash: snapshot.hash,
				metadata: snapshot.metadata,
				dirty: false,
				lastAccessed: now,
				openTabCount: this.pendingOpenTabCounts.get(filePath) ?? 0,
				snapshots: [],
			}

			if ((this.loadVersions.get(filePath) ?? 0) !== version) {
				return this.entries.get(filePath) ?? loadedEntry
			}

			const existing = this.entries.get(filePath)
			if (existing?.dirty) return existing
			this.pendingOpenTabCounts.delete(filePath)
			this.entries.set(filePath, loadedEntry)
			if (loadedEntry.openTabCount > 0) this.startSnapshotTimer(filePath)
			return loadedEntry
		})
		let trackedPromise: Promise<NoteCacheEntry>
		trackedPromise = loadPromise.finally(() => {
			const currentLoad = this.entryLoads.get(filePath)
			if (currentLoad?.promise === trackedPromise) this.entryLoads.delete(filePath)
		})

		this.entryLoads.set(filePath, {
			version,
			promise: trackedPromise,
		})
		return trackedPromise
	}

	private invalidateLoad(filePath: string) {
		this.loadVersions.set(filePath, (this.loadVersions.get(filePath) ?? 0) + 1)
		this.entryLoads.delete(filePath)
	}

	write(filePath: string, content: string) {
		const entry = this.entries.get(filePath)
		if (!entry) return

		entry.content = content
		entry.dirty = content !== entry.diskContent
		entry.lastAccessed = Date.now()

		if (entry.dirty) {
			this.scheduleSave(filePath)
		}
	}

	writeExternal(filePath: string, content: string) {
		const entry = this.entries.get(filePath)
		if (!entry) return

		entry.content = content
		entry.dirty = content !== entry.diskContent
		entry.lastAccessed = Date.now()

		if (entry.dirty) {
			this.scheduleSave(filePath)
		}

		this.notifyContentChange(filePath, content)
	}

	primeClean(
		filePath: string,
		content: string,
		hash: string,
		options: { localCreated?: boolean; metadata?: FileMetadata } = {},
	) {
		const existing = this.entries.get(filePath)
		const now = Date.now()
		const openTabCount = existing?.openTabCount ?? this.pendingOpenTabCounts.get(filePath) ?? 0
		const saveTimer = this.saveTimers.get(filePath)
		if (saveTimer) {
			clearTimeout(saveTimer)
			this.saveTimers.delete(filePath)
		}
		this.invalidateLoad(filePath)
		this.pendingOpenTabCounts.delete(filePath)

		this.entries.set(filePath, {
			filePath,
			content,
			diskContent: content,
			mtime: options.metadata?.modifiedAt ?? now,
			hash,
			metadata: options.metadata,
			dirty: false,
			lastAccessed: now,
			openTabCount,
			snapshots: [],
			localCreatedAt: options.localCreated ? now : existing?.localCreatedAt,
		})

		if (openTabCount > 0) this.startSnapshotTimer(filePath)
	}

	forget(filePath: string, options: { descendants?: boolean } = {}) {
		const paths = options.descendants
			? Array.from(
					new Set([
						...this.entries.keys(),
						...this.entryLoads.keys(),
						...this.pendingOpenTabCounts.keys(),
						...this.externalChangeLoads.keys(),
					]),
				).filter((path) => path === filePath || path.startsWith(`${filePath}/`))
			: [filePath]

		for (const path of paths) {
			const saveTimer = this.saveTimers.get(path)
			if (saveTimer) {
				clearTimeout(saveTimer)
				this.saveTimers.delete(path)
			}
			this.stopSnapshotTimer(path)
			this.invalidateLoad(path)
			this.entries.delete(path)
			this.contentChangeListeners.delete(path)
			this.externalChangeLoads.delete(path)
			this.pendingOpenTabCounts.delete(path)
		}
	}

	onContentChange(filePath: string, listener: ContentChangeListener): () => void {
		if (!this.contentChangeListeners.has(filePath)) {
			this.contentChangeListeners.set(filePath, new Set())
		}
		this.contentChangeListeners.get(filePath)!.add(listener)
		return () => {
			const listeners = this.contentChangeListeners.get(filePath)
			if (listeners) {
				listeners.delete(listener)
				if (listeners.size === 0) this.contentChangeListeners.delete(filePath)
			}
		}
	}

	private notifyContentChange(filePath: string, content: string) {
		const listeners = this.contentChangeListeners.get(filePath)
		if (listeners) {
			for (const listener of listeners) listener(filePath, content)
		}
	}

	private scheduleSave(filePath: string) {
		const existing = this.saveTimers.get(filePath)
		if (existing) clearTimeout(existing)

		const timer = setTimeout(() => {
			this.saveTimers.delete(filePath)
			this.flush(filePath)
		}, AUTOSAVE_DEBOUNCE_MS)

		this.saveTimers.set(filePath, timer)
	}

	async flush(filePath: string): Promise<void> {
		const entry = this.entries.get(filePath)
		if (!entry || !entry.dirty) return

		const timer = this.saveTimers.get(filePath)
		if (timer) {
			clearTimeout(timer)
			this.saveTimers.delete(filePath)
		}

		const platform = getPlatform()
		const preparedContent = await prepareNoteForSave(filePath, entry.content)
		if (preparedContent !== entry.content) {
			entry.content = preparedContent
			this.notifyContentChange(filePath, preparedContent)
		}
		this.takeSnapshot(filePath, "pre-save")
		await platform.fs.writeFile(filePath, entry.content)
		const [hash, metadata] = await Promise.all([
			platform.fs.hashFile(filePath),
			platform.fs.getFileMetadata(filePath),
		])

		entry.diskContent = entry.content
		entry.dirty = false
		entry.hash = hash
		entry.metadata = metadata
		entry.mtime = metadata.modifiedAt
	}

	async flushAll(): Promise<void> {
		const dirtyPaths = Array.from(this.entries.entries()).flatMap(([path, entry]) =>
			entry.dirty ? [path] : [],
		)

		await Promise.all(dirtyPaths.map((p) => this.flush(p)))
	}

	renamePath(oldPath: string, newPath: string) {
		if (oldPath === newPath) return
		const paths = Array.from(this.entries.keys()).filter(
			(path) => replacePathPrefix(path, oldPath, newPath) !== null,
		)
		const pendingPaths = Array.from(
			new Set([...this.pendingOpenTabCounts.keys(), ...this.entryLoads.keys()]),
		).filter((path) => replacePathPrefix(path, oldPath, newPath) !== null)

		for (const path of paths) {
			const nextPath = replacePathPrefix(path, oldPath, newPath)
			const entry = this.entries.get(path)
			if (!nextPath || !entry) continue

			const saveTimer = this.saveTimers.get(path)
			if (saveTimer) {
				clearTimeout(saveTimer)
				this.saveTimers.delete(path)
			}
			this.stopSnapshotTimer(path)
			const contentListeners = this.contentChangeListeners.get(path)
			const externalChangeLoad = this.externalChangeLoads.get(path)
			this.entries.delete(path)
			this.contentChangeListeners.delete(path)
			this.externalChangeLoads.delete(path)

			entry.filePath = nextPath
			this.entries.set(nextPath, entry)
			if (contentListeners) this.contentChangeListeners.set(nextPath, contentListeners)
			if (externalChangeLoad) this.externalChangeLoads.set(nextPath, externalChangeLoad)

			if (entry.dirty) this.scheduleSave(nextPath)
			if (entry.openTabCount > 0) this.startSnapshotTimer(nextPath)
		}

		for (const path of pendingPaths) {
			const nextPath = replacePathPrefix(path, oldPath, newPath)
			if (!nextPath) continue
			const openTabCount = this.pendingOpenTabCounts.get(path) ?? 0
			this.invalidateLoad(path)
			if (openTabCount === 0) continue
			this.pendingOpenTabCounts.delete(path)
			this.pendingOpenTabCounts.set(
				nextPath,
				(this.pendingOpenTabCounts.get(nextPath) ?? 0) + openTabCount,
			)
			void this.loadEntry(nextPath).catch(() => {})
		}
	}

	openTab(filePath: string) {
		const entry = this.entries.get(filePath)
		if (entry) {
			entry.openTabCount++
			this.startSnapshotTimer(filePath)
			return
		}
		this.pendingOpenTabCounts.set(filePath, (this.pendingOpenTabCounts.get(filePath) ?? 0) + 1)
		void this.loadEntry(filePath).catch(() => {})
	}

	async closeTab(filePath: string) {
		const entry = this.entries.get(filePath)
		if (!entry) {
			const pendingCount = this.pendingOpenTabCounts.get(filePath)
			if (pendingCount) {
				const nextCount = Math.max(0, pendingCount - 1)
				if (nextCount === 0) this.pendingOpenTabCounts.delete(filePath)
				else this.pendingOpenTabCounts.set(filePath, nextCount)
			}
			return
		}

		if (entry.dirty) await this.flush(filePath)

		entry.openTabCount = Math.max(0, entry.openTabCount - 1)

		if (entry.openTabCount === 0) {
			this.stopSnapshotTimer(filePath)
		}
	}

	private startSnapshotTimer(filePath: string) {
		if (this.snapshotTimers.has(filePath)) return
		const timer = setInterval(() => {
			this.takeSnapshot(filePath, "auto")
		}, SNAPSHOT_INTERVAL_MS)
		this.snapshotTimers.set(filePath, timer)
	}

	private stopSnapshotTimer(filePath: string) {
		const timer = this.snapshotTimers.get(filePath)
		if (timer) {
			clearInterval(timer)
			this.snapshotTimers.delete(filePath)
		}
	}

	takeSnapshot(filePath: string, trigger: SnapshotTrigger): Snapshot | null {
		const entry = this.entries.get(filePath)
		if (!entry) return null

		const lastSnapshot = entry.snapshots.at(-1)
		if (trigger === "auto" && lastSnapshot?.content === entry.content) {
			return null
		}

		const snapshot: Snapshot = {
			timestamp: Date.now(),
			content: entry.content,
			trigger,
		}

		entry.snapshots.push(snapshot)
		this.pruneSnapshots(entry)
		return snapshot
	}

	private pruneSnapshots(entry: NoteCacheEntry) {
		const retentionMs = SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000
		const cutoff = Date.now() - retentionMs
		entry.snapshots = entry.snapshots
			.filter((s) => s.timestamp > cutoff)
			.slice(-SNAPSHOT_MAX_PER_FILE)
	}

	handleExternalChange(filePath: string, newHash: string): Promise<void> {
		const existing = this.externalChangeLoads.get(filePath)
		if (existing) {
			existing.latestHash = newHash
			return existing.promise
		}
		const load = {
			latestHash: newHash,
			promise: Promise.resolve(),
		}
		load.promise = this.processExternalChanges(filePath, load).finally(() => {
			this.externalChangeLoads.delete(filePath)
		})
		this.externalChangeLoads.set(filePath, load)
		return load.promise
	}

	private async processExternalChanges(
		filePath: string,
		load: ExternalChangeLoad,
		processedHash: string | null = null,
	): Promise<void> {
		if (processedHash === load.latestHash) return
		const targetHash: string = load.latestHash
		const entry = this.entries.get(filePath)
		if (!entry || targetHash === entry.hash) return
		if (entry.dirty) {
			const snapshot = this.takeSnapshot(filePath, "pre-sync")
			if (snapshot) this.notifyExternalChange({ filePath, kind: "conflict", snapshot })
			return
		}

		const platform = getPlatform()
		const snapshot = await platform.fs.readFileSnapshot(filePath)
		const content = snapshot.content
		const actualHash = snapshot.hash
		const contentChanged = content !== entry.content
		entry.content = content
		entry.diskContent = content
		entry.hash = actualHash
		entry.metadata = snapshot.metadata
		entry.mtime = snapshot.metadata.modifiedAt
		entry.localCreatedAt = undefined

		if (contentChanged) {
			this.notifyContentChange(filePath, content)
			this.notifyExternalChange({
				filePath,
				kind: "overwrite",
				snapshot: { timestamp: Date.now(), content, trigger: "auto" },
			})
		}

		return this.processExternalChanges(filePath, load, targetHash)
	}

	private notifyExternalChange(event: ExternalChangeEvent) {
		for (const listener of this.externalChangeListeners) listener(event)
	}

	onExternalChange(listener: ExternalChangeListener): () => void {
		this.externalChangeListeners.push(listener)
		return () => {
			this.externalChangeListeners = this.externalChangeListeners.filter((l) => l !== listener)
		}
	}

	private async runEviction() {
		const now = Date.now()
		const toEvict: string[] = []

		for (const [path, entry] of this.entries) {
			if (entry.openTabCount > 0) continue
			if (now - entry.lastAccessed > EVICTION_IDLE_MS) {
				toEvict.push(path)
			}
		}

		await Promise.all(
			toEvict.map(async (path) => {
				await this.flush(path)
				this.entries.delete(path)
			}),
		)
	}

	getEntry(filePath: string): NoteCacheEntry | undefined {
		return this.entries.get(filePath)
	}

	getSnapshots(filePath: string): Snapshot[] {
		return this.entries.get(filePath)?.snapshots ?? []
	}

	isDirty(filePath: string): boolean {
		return this.entries.get(filePath)?.dirty ?? false
	}

	clear() {
		this.stop()
		this.entries.clear()
		this.externalChangeLoads.clear()
		this.entryLoads.clear()
		this.pendingOpenTabCounts.clear()
		this.loadVersions.clear()
	}
}

export const noteCache = new NoteCache()
