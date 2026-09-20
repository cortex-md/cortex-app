import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { ConflictResolver } from "./conflict"
import { loadVek } from "./crypto"
import { type NoteSyncMetadata, SyncDb } from "./db"
import { Downloader } from "./downloader"
import { hashContent } from "./hash"
import {
	type DeviceLike,
	isSubscriptionAccessError,
	type KeychainLike,
	type SyncHttpClient,
	subscriptionAccessMessage,
	subscriptionCodeFromText,
} from "./http"
import { defaultSyncPreferences, type SyncPreferences, shouldIgnorePath } from "./ignore"
import { InitialSync } from "./initial"
import { toVaultRelativePath } from "./paths"
import { type QueueItem, type SyncOp, SyncQueue } from "./queue"
import { Reconciler } from "./reconcile"
import { SseClient } from "./sse"
import {
	type ConnectionMode,
	isRetriableSyncErrorMessage,
	type SyncCommand,
	type SyncEngineState,
} from "./state"
import { Uploader } from "./uploader"

const UPLOAD_DEBOUNCE_MS = 5_000
const DELETE_CORRELATION_WINDOW_MS = 1_000
const POLL_INTERVAL_MS = 30_000
const RETRY_RELOAD_INTERVAL_MS = 60_000
const QUEUE_INTERVAL_MS = 25
const DEBOUNCE_INTERVAL_MS = 1_000

export type SyncEngineEventEmitter = (name: string, payload?: unknown) => void

export interface SyncEngineDeps {
	client: SyncHttpClient
	keychain: KeychainLike
	device: DeviceLike
	onEvent: SyncEngineEventEmitter
}

interface PollEvent {
	id: number
	event_type: string
	file_path: string
	version?: number | null
	device_id: string
	actor_id: string
	created_at: string
	metadata?: { old_path?: string } | null
}

function matchesSyncedHash(db: SyncDb | null, path: string, hash: string): boolean {
	return db?.getSyncState(path)?.localHash === hash
}

function completeCreationLookup(db: SyncDb, path: string): void {
	db.upsertNoteMetadata(path, {
		createdAt: null,
		createdBy: null,
		lastEditedAt: null,
		lastEditedBy: null,
		lastDeviceId: null,
		synced: true,
		creationLookupComplete: true,
	})
}

function parseSyncEventId(eventId: string, label: string): number {
	const parsed = Number(eventId)
	if (!Number.isFinite(parsed)) {
		throw new Error(`${label} event ID is not numeric: ${eventId}`)
	}
	return parsed
}

function currentProcessedEventId(lastEventId: string | null): number {
	if (!lastEventId) return 0
	return parseSyncEventId(lastEventId, "stored")
}

function queuedSourceEventIds(db: SyncDb | null): number[] {
	if (!db) return []
	return db.listQueuedSourceEventIds().map((eventId) => parseSyncEventId(eventId, "queued source"))
}

function recordProcessedEvent(
	lastEventId: { value: string | null },
	processedEventIds: Set<number>,
	db: SyncDb | null,
	eventId: string,
): boolean {
	if (!eventId) return false
	const processedEventId = parseSyncEventId(eventId, "processed")
	const currentEventId = currentProcessedEventId(lastEventId.value)
	if (processedEventId <= currentEventId) return false

	processedEventIds.add(processedEventId)
	const queued = queuedSourceEventIds(db)
	let nextEventId: number | null = null
	for (const candidate of processedEventIds) {
		if (candidate <= currentEventId) continue
		const blocked = queued.some((queuedId) => queuedId > currentEventId && queuedId <= candidate)
		if (blocked) continue
		if (nextEventId === null || candidate > nextEventId) nextEventId = candidate
	}
	if (nextEventId === null) return false

	lastEventId.value = String(nextEventId)
	db?.setMetadata("last_event_id", lastEventId.value)
	for (const id of [...processedEventIds]) {
		if (id <= nextEventId) processedEventIds.delete(id)
	}
	return true
}

export class SyncEngine {
	private state: SyncEngineState = "idle"
	private queue = new SyncQueue()
	private vaultId: string | null = null
	private vaultPath: string | null = null
	private serverUrl: string | null = null
	private db: SyncDb | null = null
	private vek: Buffer | null = null
	private pendingUploads = new Map<string, number>()
	private pendingDeletes = new Map<string, { at: number; hash: string | null }>()
	private sseClient: SseClient | null = null
	private connectionMode: ConnectionMode = "disconnected"
	private lastEventId: string | null = null
	private processedRemoteEventIds = new Set<number>()
	private syncPreferences = defaultSyncPreferences()
	private running = false
	private commandQueue: SyncCommand[] = []
	private commandWaiters: Array<() => void> = []
	private timers: NodeJS.Timeout[] = []

	constructor(private readonly deps: SyncEngineDeps) {}

	enqueue(command: SyncCommand): void {
		this.commandQueue.push(command)
		const waiter = this.commandWaiters.shift()
		waiter?.()
	}

	async run(): Promise<void> {
		this.running = true
		this.timers = [
			setInterval(() => {
				this.flushPendingUploads()
				this.flushPendingDeletes()
			}, DEBOUNCE_INTERVAL_MS),
			setInterval(() => {
				if (this.connectionMode === "polling" && this.vaultId) {
					this.enqueue({ type: "pollTick" })
				}
			}, POLL_INTERVAL_MS),
			setInterval(() => {
				if (this.vaultId) this.queue.reloadReady()
			}, RETRY_RELOAD_INTERVAL_MS),
			setInterval(() => {
				if (!this.queue.isEmpty()) {
					void this.processNextQueueItem()
				}
			}, QUEUE_INTERVAL_MS),
		]

		while (this.running) {
			const command = await this.nextCommand()
			if (!command) break
			await this.handleCommand(command)
		}
	}

	stopLoop(): void {
		this.running = false
		for (const timer of this.timers) clearInterval(timer)
		this.timers = []
		this.sseClient?.stop()
		const waiter = this.commandWaiters.shift()
		waiter?.()
	}

	private nextCommand(): Promise<SyncCommand | null> {
		if (this.commandQueue.length > 0) {
			return Promise.resolve(this.commandQueue.shift() ?? null)
		}
		if (!this.running) return Promise.resolve(null)
		return new Promise((resolve) => {
			this.commandWaiters.push(() => {
				resolve(this.commandQueue.shift() ?? null)
			})
		})
	}

	private async handleCommand(command: SyncCommand): Promise<void> {
		switch (command.type) {
			case "start":
				await this.handleStart(
					command.vaultId,
					command.vaultPath,
					command.serverUrl,
					command.requiresEntitlement,
				)
				return
			case "stop":
				this.handleStop()
				return
			case "localFileChanged": {
				const relative = this.toRelativePath(command.path)
				if (!shouldIgnorePath(relative, this.syncPreferences)) {
					this.handleLocalFileChanged(relative)
				}
				return
			}
			case "localFileDeleted": {
				const relative = this.toRelativePath(command.path)
				if (!shouldIgnorePath(relative, this.syncPreferences)) {
					this.handleLocalFileDeleted(relative)
				}
				return
			}
			case "forceSyncFile": {
				const relative = this.toRelativePath(command.path)
				if (!shouldIgnorePath(relative, this.syncPreferences)) {
					this.pendingUploads.delete(relative)
					const [op, priority] = SyncQueue.upload(relative)
					this.queue.push(op, priority)
				}
				return
			}
			case "remoteFileChanged":
				if (!shouldIgnorePath(command.path, this.syncPreferences)) {
					this.db?.upsertNoteMetadata(command.path, {
						createdAt: command.created ? (command.editedAt ?? null) : null,
						createdBy: command.created ? command.actorId : null,
						lastEditedAt: command.editedAt ?? null,
						lastEditedBy: command.actorId,
						lastDeviceId: command.deviceId,
						synced: true,
						creationLookupComplete: command.created,
					})
					const [op, priority] = SyncQueue.download(command.path, command.version)
					if (command.eventId) {
						try {
							this.queue.pushFromEvent(op, priority, command.eventId)
						} catch (error) {
							this.emitLog(
								"warn",
								`Skipping queued remote event: ${error instanceof Error ? error.message : String(error)}`,
							)
						}
					} else {
						this.queue.push(op, priority)
					}
				} else if (command.eventId) {
					this.markEventProcessed(command.eventId)
				}
				return
			case "remoteFileDeleted":
				if (!shouldIgnorePath(command.path, this.syncPreferences)) {
					const op: SyncOp = { type: "delete", path: command.path }
					if (command.eventId) {
						try {
							this.queue.pushFromEvent(op, 80, command.eventId)
						} catch (error) {
							this.emitLog(
								"warn",
								`Skipping queued remote event: ${error instanceof Error ? error.message : String(error)}`,
							)
						}
					} else {
						this.queue.push(op, 80)
					}
				} else if (command.eventId) {
					this.markEventProcessed(command.eventId)
				}
				return
			case "remoteFileRenamed":
				if (!shouldIgnorePath(command.newPath, this.syncPreferences)) {
					const op: SyncOp = {
						type: "rename",
						oldPath: command.oldPath,
						newPath: command.newPath,
					}
					if (command.eventId) {
						try {
							this.queue.pushFromEvent(op, 80, command.eventId)
						} catch (error) {
							this.emitLog(
								"warn",
								`Skipping queued remote event: ${error instanceof Error ? error.message : String(error)}`,
							)
						}
					} else {
						this.queue.push(op, 80)
					}
				} else if (command.eventId) {
					this.markEventProcessed(command.eventId)
				}
				return
			case "remoteEventProcessed":
				this.markEventProcessed(command.eventId)
				return
			case "resolveConflict": {
				const [, priority] = SyncQueue.conflict(command.path)
				this.queue.push(
					{
						type: "resolveConflict",
						path: command.path,
						resolution: command.resolution,
					},
					priority,
				)
				return
			}
			case "accessDenied":
				this.handleAccessDenied(command.reason, command.kind, command.code ?? null)
				return
			case "sseConnected":
				await this.handleSseConnected()
				return
			case "sseDisconnected":
				this.handleSseDisconnected()
				return
			case "reconcile":
				await this.handleReconcile()
				return
			case "pollTick":
				await this.handlePollTick()
				return
			case "updateSyncPreferences":
				this.handleUpdateSyncPreferences({
					syncSettings: command.syncSettings,
					syncHotkeys: command.syncHotkeys,
					syncWorkspace: command.syncWorkspace,
					syncPluginMetadata: command.syncPluginMetadata,
					syncThemeMetadata: command.syncThemeMetadata,
					syncBookmarks: command.syncBookmarks,
					ignoreImages: command.ignoreImages,
					excludedPaths: command.excludedPaths,
				})
				return
		}
	}

	private setState(newState: SyncEngineState): void {
		if (this.state === newState) return
		this.state = newState
		this.emitLog("info", `Sync state: ${newState}`)
		this.deps.onEvent("sync-state-changed", { state: newState })
	}

	private emitLog(level: string, message: string): void {
		this.deps.onEvent("sync-log", { level, message })
	}

	private emitFileEvent(path: string, status: string): void {
		this.deps.onEvent("sync-file-event", { path, status })
	}

	private markEventProcessed(eventId: string): void {
		const holder = { value: this.lastEventId }
		try {
			recordProcessedEvent(holder, this.processedRemoteEventIds, this.db, eventId)
			this.lastEventId = holder.value
		} catch (error) {
			this.emitLog(
				"warn",
				`Skipping sync cursor advancement: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private async handleStart(
		vaultId: string,
		vaultPath: string,
		serverUrl: string,
		requiresEntitlement: boolean,
	): Promise<void> {
		this.setState("connecting")
		this.deps.client.setServerUrl(serverUrl)

		if (requiresEntitlement) {
			try {
				await this.validateSubscription()
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error)
				this.handleAccessDenied(reason, "subscription", subscriptionCodeFromText(reason))
				return
			}
		}

		try {
			this.db = SyncDb.open(vaultPath)
			this.queue.setDb(this.db)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			this.emitLog("error", `Sync database error: ${message}`)
			this.emitFileEvent("", `db-error: ${message}`)
			this.setState("idle")
			return
		}

		try {
			const vek = loadVek(this.deps.keychain, vaultId)
			if (!vek) {
				this.emitLog("warn", "Vault encryption key required")
				this.deps.onEvent("sync-vek-required")
				this.setState("idle")
				return
			}
			this.vek = vek
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			this.emitLog("error", `Vault encryption key error: ${message}`)
			this.emitFileEvent("", `vek-error: ${message}`)
			this.setState("idle")
			return
		}

		this.lastEventId = this.db.getMetadata("last_event_id")
		const loaded = this.queue.loadFromDb()
		if (loaded > 0) {
			this.emitFileEvent("", `resumed ${loaded} queued ops`)
		}

		this.vaultId = vaultId
		this.vaultPath = vaultPath
		this.serverUrl = serverUrl

		let initialOk = false
		try {
			await this.runInitialSync()
			initialOk = true
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			if (isSubscriptionAccessError(message)) {
				this.handleAccessDenied(
					subscriptionAccessMessage(subscriptionCodeFromText(message)),
					"subscription",
					subscriptionCodeFromText(message),
				)
				return
			}
			this.emitLog("error", `Initial sync failed: ${message}`)
			this.emitFileEvent("", `initial-sync-error: ${message}`)
		}

		if (initialOk) this.enqueueIncompleteCreationMetadata()
		const sseStarted = this.startSseListener()
		if (initialOk && sseStarted) {
			this.setState("live")
		} else {
			this.connectionMode = "polling"
			this.setState("offline")
		}
	}

	private resetEngine(): void {
		this.sseClient?.stop()
		this.sseClient = null
		this.db?.removeQueueOpsByType("lookup_creation_metadata")
		this.db?.close()
		this.vaultId = null
		this.vaultPath = null
		this.serverUrl = null
		this.db = null
		this.vek = null
		this.pendingUploads.clear()
		this.pendingDeletes.clear()
		this.connectionMode = "disconnected"
		this.lastEventId = null
		this.processedRemoteEventIds.clear()
		this.queue = new SyncQueue()
	}

	private handleStop(): void {
		this.resetEngine()
		this.setState("idle")
	}

	private async validateSubscription(): Promise<void> {
		const response = await this.deps.client.get("/subscription/v1/status")
		if (response.status === 404) return
		const body = await response.text()
		if (!response.ok) {
			if (response.status === 402 || isSubscriptionAccessError(body)) {
				throw new Error(subscriptionAccessMessage(subscriptionCodeFromText(body)))
			}
			throw new Error(`Subscription status failed: HTTP ${response.status}: ${body}`)
		}
		const parsed = JSON.parse(body) as { entitled?: boolean; status?: string }
		if (parsed.entitled) return
		const code =
			parsed.status === "expired" || parsed.status === "cancelled"
				? "subscription_expired"
				: "subscription_required"
		throw new Error(subscriptionAccessMessage(code))
	}

	private handleAccessDenied(reason: string, kind: string, code: string | null): void {
		this.deps.onEvent("sync-vault-access-denied", { reason, kind, code })
		this.resetEngine()
		this.setState("denied")
	}

	private handleUpdateSyncPreferences(preferences: SyncPreferences): void {
		const old = this.syncPreferences
		this.syncPreferences = preferences
		for (const path of [...this.pendingUploads.keys()]) {
			if (shouldIgnorePath(path, preferences)) this.pendingUploads.delete(path)
		}
		for (const path of [...this.pendingDeletes.keys()]) {
			if (shouldIgnorePath(path, preferences)) this.pendingDeletes.delete(path)
		}
		if (!this.vaultPath) return

		const newlyEnabled = [
			!old.syncSettings && preferences.syncSettings ? ".cortex/app.json" : null,
			!old.syncHotkeys && preferences.syncHotkeys ? ".cortex/hotkeys.json" : null,
			!old.syncWorkspace && preferences.syncWorkspace ? ".cortex/workspace.json" : null,
			!old.syncPluginMetadata && preferences.syncPluginMetadata
				? ".cortex/sync-plugins.json"
				: null,
			!old.syncThemeMetadata && preferences.syncThemeMetadata ? ".cortex/sync-themes.json" : null,
			!old.syncBookmarks && preferences.syncBookmarks ? ".cortex/bookmarks.json" : null,
		].filter((value): value is string => value !== null)

		for (const filePath of newlyEnabled) {
			const [op, priority] = SyncQueue.upload(filePath)
			this.queue.push(op, priority)
		}
	}

	private async handleSseConnected(): Promise<void> {
		this.connectionMode = "sse"
		if (this.state === "offline") {
			this.setState("recovering")
			await this.handleReconcile()
			this.setState("live")
		} else {
			this.setState("live")
		}
	}

	private handleSseDisconnected(): void {
		this.connectionMode = "polling"
		this.setState("offline")
	}

	private async handleReconcile(): Promise<void> {
		if (!this.db || !this.vek || !this.vaultId || !this.vaultPath) return
		const reconciler = new Reconciler(
			this.deps.onEvent,
			this.deps.client,
			this.db,
			this.vaultId,
			this.vaultPath,
			this.vek,
			this.deps.device.getDeviceId(),
			this.syncPreferences,
		)
		try {
			const newEventId = await reconciler.run(this.lastEventId)
			if (newEventId) {
				this.lastEventId = newEventId
				this.db.setMetadata("last_event_id", newEventId)
			}
			this.enqueueIncompleteCreationMetadata()
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			this.emitLog("error", `Reconciliation failed: ${message}`)
			this.emitFileEvent("", `reconcile-error: ${message}`)
		}
	}

	private enqueueIncompleteCreationMetadata(): void {
		if (!this.db) return
		for (const path of this.db.listIncompleteCreationMetadata()) {
			const [operation, priority] = SyncQueue.lookupCreationMetadata(path)
			this.queue.push(operation, priority)
		}
	}

	private async handlePollTick(): Promise<void> {
		if (!this.db || !this.vek || !this.vaultId || !this.vaultPath) return
		const since = this.lastEventId ?? "0"
		const apiPath = `/sync/v1/vaults/${this.vaultId}/changes?since=${since}&limit=50`
		let response: Awaited<ReturnType<SyncHttpClient["get"]>>
		try {
			response = await this.deps.client.get(apiPath)
		} catch {
			return
		}

		if (response.status === 402) {
			const body = await response.text()
			this.handleAccessDenied(
				subscriptionAccessMessage(subscriptionCodeFromText(body)),
				"subscription",
				subscriptionCodeFromText(body),
			)
			return
		}
		if (response.status === 403) {
			const body = await response.text()
			this.handleAccessDenied(`HTTP 403: ${body}`, "vault", null)
			return
		}
		if (!response.ok) return

		const ownDeviceId = this.deps.device.getDeviceId()
		const events = await response.json<PollEvent[]>()
		for (const event of events) {
			const planned = planPollEvent(event, ownDeviceId, this.syncPreferences)
			if (planned.noteMetadata) {
				this.db.upsertNoteMetadata(planned.noteMetadata.path, planned.noteMetadata.metadata)
			}
			if (planned.queueItem) {
				try {
					this.queue.pushFromEvent(
						planned.queueItem.op,
						planned.queueItem.priority,
						planned.queueItem.eventId,
					)
				} catch (error) {
					this.emitLog(
						"warn",
						`Skipping queued remote event: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
			if (planned.processedEventId) {
				this.markEventProcessed(planned.processedEventId)
			}
		}
	}

	private handleLocalFileChanged(relative: string): void {
		if (this.vaultPath) {
			const fullPath = join(this.vaultPath, relative)
			try {
				const content = readFileSync(fullPath)
				const newHash = hashContent(content)
				if (matchesSyncedHash(this.db, relative, newHash)) return

				let matchedOldPath: string | null = null
				const now = Date.now()
				for (const [delPath, pending] of this.pendingDeletes) {
					if (now - pending.at <= DELETE_CORRELATION_WINDOW_MS && pending.hash === newHash) {
						matchedOldPath = delPath
						break
					}
				}
				if (matchedOldPath) {
					this.pendingDeletes.delete(matchedOldPath)
					const [op, priority] = SyncQueue.renameRemote(matchedOldPath, relative)
					this.queue.push(op, priority)
					return
				}
			} catch {
				// Fall through to upload debounce.
			}
		}
		this.pendingUploads.set(relative, Date.now())
	}

	private handleLocalFileDeleted(relative: string): void {
		this.pendingUploads.delete(relative)
		const lastHash = this.db?.getSyncState(relative)?.localHash ?? null
		this.pendingDeletes.set(relative, { at: Date.now(), hash: lastHash })
	}

	private flushPendingDeletes(): void {
		const now = Date.now()
		for (const [path, pending] of [...this.pendingDeletes]) {
			if (now - pending.at <= DELETE_CORRELATION_WINDOW_MS) continue
			this.pendingDeletes.delete(path)
			if (shouldIgnorePath(path, this.syncPreferences)) continue
			const [op, priority] = SyncQueue.deleteRemote(path)
			this.queue.push(op, priority)
		}
	}

	private flushPendingUploads(): void {
		const now = Date.now()
		for (const [path, when] of [...this.pendingUploads]) {
			if (now - when < UPLOAD_DEBOUNCE_MS) continue
			this.pendingUploads.delete(path)
			if (shouldIgnorePath(path, this.syncPreferences)) continue
			if (this.vaultPath && !existsSync(join(this.vaultPath, path))) continue
			const [op, priority] = SyncQueue.upload(path)
			this.queue.push(op, priority)
		}
	}

	private toRelativePath(absolutePath: string): string {
		if (this.vaultPath) return toVaultRelativePath(this.vaultPath, absolutePath)
		return absolutePath.replaceAll("\\", "/")
	}

	private startSseListener(): boolean {
		if (!this.vaultId || !this.serverUrl) return false
		let deviceId: string
		try {
			deviceId = this.deps.device.getDeviceId()
		} catch {
			return false
		}
		const url = `${this.serverUrl}/sync/v1/vaults/${this.vaultId}/events`
		this.sseClient?.stop()
		this.sseClient = new SseClient(
			(command) => this.enqueue(command),
			deviceId,
			this.deps.keychain,
			this.lastEventId,
		)
		void this.sseClient.connect(url, this.serverUrl, deviceId)
		return true
	}

	private async runInitialSync(): Promise<void> {
		if (!this.db || !this.vek || !this.vaultId || !this.vaultPath) {
			throw new Error("Sync engine is not ready")
		}
		this.emitLog("info", `Initial sync starting for vault ${this.vaultId}`)
		const initial = new InitialSync(
			this.deps.onEvent,
			this.deps.client,
			this.db,
			this.vaultId,
			this.vaultPath,
			this.vek,
			this.syncPreferences,
		)
		await initial.run()
		this.emitLog("info", "Initial sync completed successfully")
	}

	private async processNextQueueItem(): Promise<boolean> {
		if (!this.db || !this.vek || !this.vaultId || !this.vaultPath) return false
		const item = this.queue.pop()
		if (!item) return false

		const creationLookupPath = item.op.type === "lookupCreationMetadata" ? item.op.path : null

		if (this.shouldIgnoreQueueItem(item.op)) {
			this.completeQueueItem(item)
			return true
		}

		const client = this.deps.client
		const db = this.db
		const vek = this.vek
		const vaultId = this.vaultId
		const vaultPath = this.vaultPath

		try {
			switch (item.op.type) {
				case "upload": {
					this.emitFileEvent(item.op.path, "uploading")
					const uploader = new Uploader(client, db, vaultId, vaultPath, vek)
					await uploader.uploadFile(item.op.path)
					this.emitLog("info", `Pushed: ${item.op.path}`)
					this.emitFileEvent(item.op.path, "synced")
					break
				}
				case "download": {
					this.emitFileEvent(item.op.path, "downloading")
					const downloader = new Downloader(client, db, vaultId, vaultPath, vek)
					const result = await downloader.downloadFile(item.op.path)
					if (result.kind === "synced") {
						this.emitLog("info", `Pulled: ${item.op.path}`)
						this.emitFileEvent(item.op.path, "synced")
					} else if (result.kind === "merged") {
						this.emitLog("info", `Merged: ${item.op.path}`)
						this.emitFileEvent(item.op.path, "merged")
					} else {
						this.emitFileEvent(item.op.path, "conflict")
						this.emitLog("warn", `Conflict detected: ${item.op.path}`)
						this.deps.onEvent("sync-conflict", { path: item.op.path })
					}
					break
				}
				case "delete": {
					this.emitFileEvent(item.op.path, "deleting")
					const downloader = new Downloader(client, db, vaultId, vaultPath, vek)
					await downloader.deleteLocalFile(item.op.path)
					this.emitLog("info", `Deleted locally: ${item.op.path}`)
					this.emitFileEvent(item.op.path, "deleted")
					break
				}
				case "deleteRemote": {
					this.emitFileEvent(item.op.path, "deleting-remote")
					const uploader = new Uploader(client, db, vaultId, vaultPath, vek)
					await uploader.deleteRemoteFile(item.op.path)
					this.emitLog("info", `Deleted remote: ${item.op.path}`)
					this.emitFileEvent(item.op.path, "deleted")
					break
				}
				case "rename": {
					this.emitFileEvent(item.op.oldPath, "renaming")
					const downloader = new Downloader(client, db, vaultId, vaultPath, vek)
					await downloader.renameLocalFile(item.op.oldPath, item.op.newPath)
					this.emitFileEvent(item.op.newPath, "synced")
					break
				}
				case "renameRemote": {
					this.emitFileEvent(item.op.oldPath, "renaming-remote")
					const uploader = new Uploader(client, db, vaultId, vaultPath, vek)
					await uploader.renameRemoteFile(item.op.oldPath, item.op.newPath)
					this.emitFileEvent(item.op.newPath, "synced")
					break
				}
				case "resolveConflict": {
					if (item.op.resolution) {
						this.emitFileEvent(item.op.path, "resolving")
						const resolver = new ConflictResolver(client, db, vaultId, vaultPath, vek)
						await resolver.applyResolution(item.op.path, item.op.resolution)
						this.emitFileEvent(item.op.path, "synced")
					}
					break
				}
				case "lookupCreationMetadata": {
					const downloader = new Downloader(client, db, vaultId, vaultPath, vek)
					try {
						const versions = await downloader.getVersionHistory(item.op.path)
						versions.sort((left, right) => left.version - right.version)
						const first = versions[0]
						db.upsertNoteMetadata(item.op.path, {
							createdAt: first?.createdAt ?? null,
							createdBy: first?.authorId ?? null,
							lastEditedAt: null,
							lastEditedBy: null,
							lastDeviceId: null,
							synced: true,
							creationLookupComplete: true,
						})
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error)
						if (message.includes("HTTP 404")) {
							completeCreationLookup(db, item.op.path)
						} else {
							throw error
						}
					}
					break
				}
				case "initialSync":
				case "reconcile":
					break
			}
			this.completeQueueItem(item)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			if (isSubscriptionAccessError(message)) {
				this.emitLog("error", `Sync plan validation failed: ${message}`)
				this.handleAccessDenied(
					subscriptionAccessMessage(subscriptionCodeFromText(message)),
					"subscription",
					subscriptionCodeFromText(message),
				)
				return true
			}
			this.emitLog("error", `Sync operation failed: ${message}`)
			const retriable = isRetriableSyncErrorMessage(message)
			const exhausted = item.retryCount + 1 >= item.maxRetries
			if (creationLookupPath && (!retriable || exhausted)) {
				completeCreationLookup(db, creationLookupPath)
			}
			this.queue.markFailed(item, message, retriable)
		}
		return true
	}

	private completeQueueItem(item: QueueItem): void {
		this.queue.markCompleted(item)
		if (!item.sourceEventId) return
		this.markEventProcessed(item.sourceEventId)
	}

	private shouldIgnoreQueueItem(op: SyncOp): boolean {
		switch (op.type) {
			case "upload":
			case "download":
			case "delete":
			case "deleteRemote":
			case "resolveConflict":
			case "lookupCreationMetadata":
				return shouldIgnorePath(op.path, this.syncPreferences)
			case "rename":
			case "renameRemote":
				return shouldIgnorePath(op.newPath, this.syncPreferences)
			case "initialSync":
			case "reconcile":
				return false
		}
	}
}

function planPollEvent(
	event: PollEvent,
	ownDeviceId: string,
	syncPreferences: SyncPreferences,
): {
	queueItem: { op: SyncOp; priority: number; eventId: string } | null
	noteMetadata: { path: string; metadata: NoteSyncMetadata } | null
	processedEventId: string | null
} {
	const eventId = String(event.id)
	if (event.device_id === ownDeviceId || shouldIgnorePath(event.file_path, syncPreferences)) {
		return { queueItem: null, noteMetadata: null, processedEventId: eventId }
	}

	let noteMetadata: { path: string; metadata: NoteSyncMetadata } | null = null
	if (
		event.event_type === "file_created" ||
		event.event_type === "file_updated" ||
		event.event_type === "file_renamed"
	) {
		noteMetadata = {
			path: event.file_path,
			metadata: {
				createdAt: event.event_type === "file_created" ? event.created_at : null,
				createdBy: event.event_type === "file_created" ? event.actor_id : null,
				lastEditedAt: event.created_at,
				lastEditedBy: event.actor_id,
				lastDeviceId: event.device_id,
				synced: true,
				creationLookupComplete: event.event_type === "file_created",
			},
		}
	}

	let queueItem: { op: SyncOp; priority: number; eventId: string } | null = null
	switch (event.event_type) {
		case "file_created":
		case "file_updated": {
			const [op, priority] = SyncQueue.download(event.file_path, event.version ?? 1)
			queueItem = { op, priority, eventId }
			break
		}
		case "file_deleted":
			queueItem = {
				op: { type: "delete", path: event.file_path },
				priority: 80,
				eventId,
			}
			break
		case "file_renamed": {
			const oldPath = event.metadata?.old_path ?? ""
			if (!oldPath) {
				const [op, priority] = SyncQueue.download(event.file_path, event.version ?? 1)
				queueItem = { op, priority, eventId }
			} else {
				queueItem = {
					op: { type: "rename", oldPath, newPath: event.file_path },
					priority: 80,
					eventId,
				}
			}
			break
		}
	}

	return {
		queueItem,
		noteMetadata,
		processedEventId: queueItem ? null : eventId,
	}
}
