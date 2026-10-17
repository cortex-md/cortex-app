import type {
	CollabFileSyncRole,
	EffectiveAccess,
	KeyTrustIssue,
	SyncEngineState,
	SyncPreferences,
	VaultMember,
	VaultOverview,
} from "@cortex/platform"
import { hashBytes } from "@cortex/platform/hash"
import {
	CORTEX_SYNCABLE_FILES,
	createDefaultSyncPreferences,
	shouldIgnoreSyncPath,
} from "@cortex/platform/sync-rules"
import { toVaultRelativePath } from "@cortex/platform/utils"
import {
	ApiClient,
	getServerCapabilities,
	getSubscriptionStatus,
	getVaultOverview,
	grantVaultKey,
	isCursorExpired,
	isPayloadTooLarge,
	isRetriable,
	listChanges,
	listPendingVaultKeys,
	type RemoteChange,
	SyncError,
	subscriptionAccessMessage,
	type TokenProvider,
	throttleDelayMs,
	updateVaultCursor,
} from "@cortex/sync-api"
import { accessFor, READ_ONLY_ACCESS, type SyncAccess } from "./access"
import { fromBase64, toBase64, utf8Decode } from "./bytes"
import { getAllConflicts } from "./conflict"
import { EventCursor } from "./cursor"
import { SyncDb, syncDbPath } from "./db"
import { keyFingerprint, sealVaultKey } from "./keys"
import { planRemoteChange } from "./planner"
import type { EmitSyncEvent, RpcRequest, SyncCommand, VaultRef, WorkerMethods } from "./protocol"
import { opPath, opTargetPath, type QueueItem, type SyncOp, SyncQueue } from "./queue"
import { downloadMany, executeOp, fileEvent, log, runFullSync } from "./runner"
import { syncRuntime } from "./runtime"
import { SseClient } from "./sse"
import type { SyncContext, SyncLimits } from "./transfer"
import * as transfer from "./transfer"
import {
	type AccessDenial,
	type AccessScope,
	accessDenial,
	errorMessage,
	isPathForbidden,
	normalizeRelativePath,
	nowSeconds,
	resolveInVault,
} from "./util"

const UPLOAD_DEBOUNCE_MS = 5_000
const DELETE_CORRELATION_WINDOW_MS = 1_000
const FLUSH_INTERVAL_MS = 1_000
const POLL_INTERVAL_MS = 30_000
const RETRY_RELOAD_INTERVAL_MS = 60_000
const CURSOR_REPORT_INTERVAL_MS = 30_000
const CHANGES_PAGE_SIZE = 100
const DOWNLOAD_DRAIN_BATCH = 100
const LONG_OFFLINE_SECONDS = 30 * 24 * 60 * 60
const LAST_RECONCILE_AT = "lastReconcileAt"
const LAST_EFFECTIVE_ACCESS = "lastEffectiveAccess"
const KEY_GRANT_ROLES = new Set(["owner", "admin"])
const ACCESS_REFRESH_EVENTS = new Set(["access_changed", "member_role_changed", "member_removed"])
const KEY_GRANT_EVENTS = new Set(["member_joined", "member_key_changed", "access_changed"])

interface LoadedAccess {
	access: SyncAccess
	effective: EffectiveAccess | null
	overview: VaultOverview | null
	cached: EffectiveAccess | null
}

function readCachedAccess(db: SyncDb): EffectiveAccess | null {
	const raw = db.getMeta(LAST_EFFECTIVE_ACCESS)
	if (!raw) return null
	try {
		return JSON.parse(raw) as EffectiveAccess
	} catch {
		return null
	}
}

function resolvePath(path: string): string {
	return syncRuntime().path.resolve(path)
}

export interface SyncEngineDeps {
	emit: EmitSyncEvent
	deviceId: () => string
	tokens: TokenProvider
	loadVek: (vaultId: string) => Promise<Uint8Array | null>
}

interface Session extends SyncContext {
	queue: SyncQueue
	cursor: EventCursor
	sse: SseClient | null
	seenEventId: string | null
	reportedEventId: string | null
	timers: ReturnType<typeof setInterval>[]
	needsFullSync: boolean
	userId: string | null
	myRole: string
	members: VaultMember[]
	effective: EffectiveAccess | null
	readOnlyLogged: Set<string>
	keyGrants: Promise<void>
}

function sameAccess(left: EffectiveAccess, right: EffectiveAccess): boolean {
	return JSON.stringify(left) === JSON.stringify(right)
}

function isFileSystemError(error: unknown): boolean {
	return error instanceof Error && "syscall" in error && "path" in error
}

async function loadLimits(api: ApiClient): Promise<SyncLimits | undefined> {
	try {
		const { limits } = await getServerCapabilities(api)
		return {
			maxUploadBytes: limits.maxUploadBytes,
			maxConcurrentUploads: limits.maxConcurrentUploads,
		}
	} catch {
		return undefined
	}
}

function shouldRetry(error: unknown): boolean {
	if (isFileSystemError(error)) return false
	return isRetriable(error) || (error instanceof SyncError && error.kind === "auth")
}

export class SyncEngine {
	private state: SyncEngineState = "idle"
	private session: Session | null = null
	private cachedDb: SyncDb | null = null
	private preferences: SyncPreferences = createDefaultSyncPreferences()
	private polling = false
	private lane: Promise<void> = Promise.resolve()
	private drainScheduled = false
	private readonly pendingUploads = new Map<string, number>()
	private readonly pendingDeletes = new Map<string, { at: number; hash: string | null }>()
	private readonly collabRoles = new Map<string, CollabFileSyncRole>()

	constructor(private readonly deps: SyncEngineDeps) {}

	dispatch(command: SyncCommand): void {
		this.serial(() => this.handleCommand(command))
	}

	private serial(task: () => Promise<void> | void): void {
		this.lane = this.lane.then(task).catch((error) => {
			log(this.deps.emit, "error", `Sync engine error: ${errorMessage(error)}`)
		})
	}

	private async handleCommand(command: SyncCommand): Promise<void> {
		switch (command.type) {
			case "start":
				await this.start(command)
				return
			case "stop":
				this.closeSession()
				this.collabRoles.clear()
				this.setState("idle")
				return
			case "localFileChanged":
				await this.onLocalChange(command.path)
				return
			case "localFileDeleted":
				this.onLocalDelete(command.path)
				return
			case "forceSyncFile": {
				const path = this.relativePath(command.path)
				if (!path || shouldIgnoreSyncPath(path, this.preferences)) return
				this.pendingUploads.delete(path)
				this.push({ type: "upload", path })
				return
			}
			case "resolveConflict": {
				const path = this.relativePath(command.path)
				if (path) this.push({ type: "resolveConflict", path, resolution: command.resolution })
				return
			}
			case "updateSyncPreferences":
				this.updatePreferences(command.preferences)
				return
			case "setCollabRole":
				this.setCollabRole(command.path, command.role)
				return
		}
	}

	private setCollabRole(path: string, role: CollabFileSyncRole | null): void {
		const relative = this.relativePath(path) ?? normalizeRelativePath(path)
		if (role) {
			this.collabRoles.set(relative, role)
			if (role === "follower") {
				this.pendingUploads.delete(relative)
				this.pendingDeletes.delete(relative)
			}
			return
		}
		if (!this.collabRoles.delete(relative) || !this.session) return
		if (!shouldIgnoreSyncPath(relative, this.preferences))
			this.push({ type: "settle", path: relative })
	}

	private isCollabFollower(path: string): boolean {
		return this.collabRoles.get(path) === "follower"
	}

	private setState(state: SyncEngineState): void {
		if (this.state === state) return
		this.state = state
		log(this.deps.emit, "info", `Sync state: ${state}`)
		this.deps.emit("sync-state-changed", { state })
	}

	private relativePath(path: string): string | null {
		if (!this.session) return null
		return (
			toVaultRelativePath(path, this.session.vaultPath) ??
			(/^([a-zA-Z]:)?[\\/]/.test(path) ? null : normalizeRelativePath(path))
		)
	}

	private async start(command: Extract<SyncCommand, { type: "start" }>): Promise<void> {
		this.closeSession()
		this.setState("connecting")
		const emit = this.deps.emit
		const api = new ApiClient(command.serverUrl, {
			deviceId: this.deps.deviceId(),
			tokens: this.deps.tokens,
		})

		if (command.requiresEntitlement) {
			const denial = await this.checkEntitlement(api)
			if (denial) {
				this.denyAccess(denial)
				return
			}
		}

		let db: SyncDb
		try {
			db = this.openDb(command.vaultPath)
		} catch (error) {
			log(emit, "error", `Sync database error: ${errorMessage(error)}`)
			fileEvent(emit, "", `db-error: ${errorMessage(error)}`)
			this.setState("idle")
			return
		}

		let vek: Uint8Array | null
		try {
			vek = await this.deps.loadVek(command.vaultId)
		} catch (error) {
			log(emit, "error", `Vault encryption key error: ${errorMessage(error)}`)
			fileEvent(emit, "", `vek-error: ${errorMessage(error)}`)
			this.releaseDb(db)
			this.setState("idle")
			return
		}
		if (!vek) {
			log(emit, "warn", "Vault encryption key required")
			emit("sync-vek-required", undefined)
			this.releaseDb(db)
			this.setState("idle")
			return
		}

		let loaded: LoadedAccess
		try {
			loaded = await this.loadAccess(api, command.vaultId, db)
		} catch (error) {
			this.releaseDb(db)
			if (!this.denyOnAccessError(error)) throw error
			return
		}

		const limits = await loadLimits(api)
		const session: Session = {
			api,
			db,
			limits,
			vaultId: command.vaultId,
			vaultPath: command.vaultPath,
			vek,
			access: loaded.access,
			queue: new SyncQueue(db),
			cursor: new EventCursor(db),
			sse: null,
			seenEventId: null,
			reportedEventId: null,
			timers: [],
			needsFullSync: true,
			userId: command.userId ?? null,
			myRole: "unknown",
			members: [],
			effective: null,
			readOnlyLogged: new Set(),
			keyGrants: Promise.resolve(),
			collabRoles: this.collabRoles,
		}
		this.session = session
		this.applyAccess(session, loaded)
		if (!loaded.effective && loaded.cached) this.deps.emit("sync-access-changed", loaded.cached)
		const resumed = session.queue.load()
		if (resumed > 0) fileEvent(emit, "", `resumed ${resumed} queued ops`)

		let initialOk = false
		try {
			log(emit, "info", `Initial sync starting for vault ${session.vaultId}`)
			const { latestEventId, readOnlyLocal } = await runFullSync(
				session,
				this.preferences,
				"initial",
				emit,
			)
			session.cursor.reset(latestEventId)
			this.logReadOnly(session, readOnlyLocal)
			session.needsFullSync = false
			session.db.setMeta(LAST_RECONCILE_AT, String(nowSeconds()))
			log(emit, "info", "Initial sync completed successfully")
			initialOk = true
		} catch (error) {
			if (this.denyOnAccessError(error)) return
			log(emit, "error", `Initial sync failed: ${errorMessage(error)}`)
			fileEvent(emit, "", `initial-sync-error: ${errorMessage(error)}`)
		}

		this.startTimers(session)
		this.startSse(session)
		if (initialOk) {
			this.setState("live")
		} else {
			this.polling = true
			this.setState("offline")
		}
		this.scheduleDrain()
		this.scheduleKeyGrants(session)
	}

	private async loadAccess(api: ApiClient, vaultId: string, db: SyncDb): Promise<LoadedAccess> {
		try {
			const overview = await getVaultOverview(api, vaultId)
			return {
				access: accessFor(overview.myAccess),
				effective: overview.myAccess,
				overview,
				cached: null,
			}
		} catch (error) {
			if (accessDenial(error)) throw error
			const cached = readCachedAccess(db)
			log(
				this.deps.emit,
				"warn",
				`Vault access lookup failed (${cached ? "using last known access" : "read-only until it succeeds"}): ${errorMessage(error)}`,
			)
			return {
				access: cached ? accessFor(cached) : READ_ONLY_ACCESS,
				effective: null,
				overview: null,
				cached,
			}
		}
	}

	private applyAccess(session: Session, loaded: LoadedAccess): boolean {
		if (loaded.overview) {
			session.myRole = loaded.overview.myRole
			session.members = loaded.overview.members
			this.pinMemberKeys(session)
		}
		if (!loaded.effective) return false
		if (session.effective && sameAccess(session.effective, loaded.effective)) return false
		const initial = session.effective === null
		session.effective = loaded.effective
		session.access = loaded.access
		session.db.setMeta(LAST_EFFECTIVE_ACCESS, JSON.stringify(loaded.effective))
		this.deps.emit("sync-access-changed", loaded.effective)
		return !initial
	}

	private async refreshAccess(session: Session): Promise<void> {
		let loaded: LoadedAccess
		try {
			loaded = await this.loadAccess(session.api, session.vaultId, session.db)
		} catch (error) {
			this.denyOnAccessError(error)
			return
		}
		if (this.session !== session) return
		const wasUnknown = session.effective === null
		const changed = this.applyAccess(session, loaded)
		if (!changed && !(wasUnknown && session.effective)) return
		log(this.deps.emit, "info", "Vault access changed; resynchronizing")
		try {
			const { latestEventId, readOnlyLocal } = await runFullSync(
				session,
				this.preferences,
				"reconcile",
				this.deps.emit,
			)
			session.cursor.reset(latestEventId)
			this.logReadOnly(session, readOnlyLocal)
		} catch (error) {
			if (this.denyOnAccessError(error)) return
			log(this.deps.emit, "error", `Access resync failed: ${errorMessage(error)}`)
		}
	}

	private logReadOnly(session: Session, paths: string[]): void {
		for (const path of paths) {
			if (session.readOnlyLogged.has(path)) continue
			session.readOnlyLogged.add(path)
			log(this.deps.emit, "info", `${path} not synced (read-only)`)
		}
	}

	private onVaultEvent(session: Session, event: string, payload: Record<string, unknown>): void {
		if (this.session !== session) return
		if (ACCESS_REFRESH_EVENTS.has(event)) {
			this.serial(() => (this.session === session ? this.refreshAccess(session) : undefined))
		}
		if (KEY_GRANT_EVENTS.has(event)) {
			const userId = event === "member_joined" && typeof payload.user_id === "string"
			this.scheduleKeyGrants(session, userId ? (payload.user_id as string) : null)
		}
	}

	private scheduleKeyGrants(session: Session, joinedUserId: string | null = null): void {
		session.keyGrants = session.keyGrants
			.then(() => this.grantPendingKeys(session, joinedUserId))
			.catch((error) => {
				if (accessDenial(error)) return
				log(this.deps.emit, "warn", `Vault key grant failed: ${errorMessage(error)}`)
			})
	}

	private pinMemberKeys(session: Session): void {
		if (!KEY_GRANT_ROLES.has(session.myRole)) return
		for (const member of session.members) {
			if (!member.publicKey || member.userId === session.userId) continue
			if (session.db.getMemberKeyPin(member.userId)) continue
			session.db.setMemberKeyPin({
				userId: member.userId,
				fingerprint: keyFingerprint(fromBase64(member.publicKey)),
				pendingFingerprint: null,
			})
		}
	}

	private trustedMemberKey(session: Session, userId: string, publicKey: string): boolean {
		const fingerprint = keyFingerprint(fromBase64(publicKey))
		const pin = session.db.getMemberKeyPin(userId)
		if (!pin) {
			session.db.setMemberKeyPin({ userId, fingerprint, pendingFingerprint: null })
			return true
		}
		if (pin.fingerprint === fingerprint) {
			if (pin.pendingFingerprint) session.db.setMemberKeyPin({ ...pin, pendingFingerprint: null })
			return true
		}
		if (pin.pendingFingerprint !== fingerprint) {
			session.db.setMemberKeyPin({ ...pin, pendingFingerprint: fingerprint })
			log(
				this.deps.emit,
				"warn",
				`Encryption key changed for member ${userId}; verify it to grant access`,
			)
			this.deps.emit("sync-key-trust-issue", {
				vaultId: session.vaultId,
				userId,
				fingerprint,
				previousFingerprint: pin.fingerprint,
			})
		}
		return false
	}

	private async grantPendingKeys(session: Session, joinedUserId: string | null): Promise<void> {
		if (this.session !== session || !KEY_GRANT_ROLES.has(session.myRole)) return
		const pending = await listPendingVaultKeys(session.api, session.vaultId)
		const targets = new Map<string, string>()
		for (const member of pending) {
			if (member.publicKey) targets.set(member.userId, member.publicKey)
		}
		if (joinedUserId && !targets.has(joinedUserId)) {
			const overview = await getVaultOverview(session.api, session.vaultId)
			session.members = overview.members
			const joined = overview.members.find((member) => member.userId === joinedUserId)
			if (joined?.publicKey) targets.set(joinedUserId, joined.publicKey)
		}
		for (const [userId, publicKey] of targets) {
			if (this.session !== session) return
			if (userId === session.userId || !this.trustedMemberKey(session, userId, publicKey)) continue
			const sealed = sealVaultKey(session.vek, fromBase64(publicKey))
			await grantVaultKey(session.api, session.vaultId, userId, toBase64(sealed))
			log(this.deps.emit, "info", `Granted vault key to member ${userId}`)
		}
	}

	private keyTrustIssues(vaultId: string): KeyTrustIssue[] {
		const session = this.session
		if (!session || session.vaultId !== vaultId) return []
		return session.db.listMemberKeyIssues().map((pin) => ({
			vaultId,
			userId: pin.userId,
			fingerprint: pin.pendingFingerprint ?? pin.fingerprint,
			previousFingerprint: pin.fingerprint,
		}))
	}

	private trustMemberKey(vaultId: string, userId: string, fingerprint: string): void {
		const session = this.session
		if (!session || session.vaultId !== vaultId) {
			throw new Error("Start sync for this vault before verifying member keys.")
		}
		session.db.setMemberKeyPin({ userId, fingerprint, pendingFingerprint: null })
		this.scheduleKeyGrants(session)
	}

	private async reportCursor(session: Session): Promise<void> {
		const current = session.cursor.value
		if (!current || current === session.reportedEventId) return
		try {
			await updateVaultCursor(session.api, session.vaultId, Number(current))
			session.reportedEventId = current
		} catch (error) {
			if (accessDenial(error) && this.session === session) {
				this.serial(() => {
					if (this.session === session) this.denyOnAccessError(error)
				})
				return
			}
			log(this.deps.emit, "warn", `Cursor report failed: ${errorMessage(error)}`)
		}
	}

	private async checkEntitlement(api: ApiClient): Promise<AccessDenial | null> {
		try {
			const status = await getSubscriptionStatus(api)
			if (status.entitled) return null
			const code =
				status.status === "expired" || status.status === "cancelled"
					? "subscription_expired"
					: "subscription_required"
			return { reason: subscriptionAccessMessage(code), kind: "subscription", code }
		} catch (error) {
			const denial = accessDenial(error)
			if (denial?.kind === "subscription") return denial
			log(this.deps.emit, "warn", `Subscription check failed: ${errorMessage(error)}`)
			return null
		}
	}

	private openDb(vaultPath: string): SyncDb {
		const cached = this.cachedDb
		if (cached && resolvePath(cached.vaultPath) === resolvePath(vaultPath)) {
			this.cachedDb = null
			return cached
		}
		return new SyncDb(vaultPath)
	}

	private releaseDb(db: SyncDb): void {
		if (db === this.session?.db || db === this.cachedDb) return
		this.cachedDb?.close()
		this.cachedDb = db
	}

	private dbFor(vaultPath: string): SyncDb | null {
		const target = resolvePath(vaultPath)
		if (this.session && resolvePath(this.session.vaultPath) === target) return this.session.db
		if (this.cachedDb && resolvePath(this.cachedDb.vaultPath) === target) return this.cachedDb
		if (!syncRuntime().fs.existsSync(syncDbPath(vaultPath))) return null
		const db = new SyncDb(vaultPath)
		this.releaseDb(db)
		return db
	}

	private closeSession(): void {
		const session = this.session
		if (!session) return
		this.session = null
		this.deps.emit("sync-access-changed", null)
		session.sse?.stop()
		for (const timer of session.timers) clearInterval(timer)
		void this.reportCursor(session)
		this.releaseDb(session.db)
		this.pendingUploads.clear()
		this.pendingDeletes.clear()
		this.polling = false
	}

	private denyAccess({ reason, kind, code }: AccessDenial): void {
		log(this.deps.emit, "error", `Sync access denied: ${reason}`)
		this.deps.emit("sync-vault-access-denied", code ? { reason, kind, code } : { reason, kind })
		this.closeSession()
		this.setState("denied")
	}

	private denyOnAccessError(error: unknown, scope: AccessScope = "vault"): boolean {
		const denial = accessDenial(error, scope)
		if (denial) this.denyAccess(denial)
		return denial !== null
	}

	private startTimers(session: Session): void {
		session.timers = [
			setInterval(() => this.flushPending(), FLUSH_INTERVAL_MS),
			setInterval(() => {
				if (this.polling) this.serial(() => this.pollChanges(session))
			}, POLL_INTERVAL_MS),
			setInterval(() => {
				if (this.session !== session) return
				if (session.effective === null) this.serial(() => this.refreshAccess(session))
				try {
					session.queue.load()
				} catch (error) {
					log(this.deps.emit, "error", `Sync queue reload failed: ${errorMessage(error)}`)
					return
				}
				this.scheduleDrain()
			}, RETRY_RELOAD_INTERVAL_MS),
			setInterval(() => void this.reportCursor(session), CURSOR_REPORT_INTERVAL_MS),
		]
	}

	private startSse(session: Session): void {
		const onSession = (task: () => Promise<void> | void) => () => {
			this.serial(() => (this.session === session ? task() : undefined))
		}
		session.sse = new SseClient(session.api, session.vaultId, session.cursor.value, {
			onConnected: onSession(() => this.onSseConnected(session)),
			onDisconnected: onSession(() => {
				this.polling = true
				this.setState("offline")
			}),
			onChange: (change) => onSession(() => this.acceptRemoteChange(session, change))(),
			onVaultEvent: (event, payload) => this.onVaultEvent(session, event, payload),
			onAccessDenied: (denial) => onSession(() => this.denyAccess(denial))(),
			onReset: onSession(() => this.resyncFromScratch(session, "event history expired")),
		})
		session.sse.start()
	}

	private async onSseConnected(session: Session): Promise<void> {
		this.polling = false
		let accessChanged: boolean
		try {
			const wasUnknown = session.effective === null
			const loaded = await this.loadAccess(session.api, session.vaultId, session.db)
			accessChanged =
				this.applyAccess(session, loaded) || (wasUnknown && session.effective !== null)
		} catch (error) {
			this.denyOnAccessError(error)
			return
		}
		if (accessChanged) {
			session.needsFullSync = true
			if (this.state !== "offline") await this.reconcile(session)
		}
		if (this.state === "offline") {
			this.setState("recovering")
			session.db.retryQueueNow()
			session.queue.load()
			await this.reconcile(session)
			this.scheduleDrain()
		}
		if (this.session === session) this.setState("live")
	}

	private async reconcile(session: Session): Promise<void> {
		try {
			const lastReconcileAt = Number(session.db.getMeta(LAST_RECONCILE_AT) ?? "0")
			const longOffline = nowSeconds() - lastReconcileAt >= LONG_OFFLINE_SECONDS
			if (!session.needsFullSync && session.cursor.value && !longOffline) {
				await this.pullChanges(session)
			} else {
				const { latestEventId, readOnlyLocal } = await runFullSync(
					session,
					this.preferences,
					"reconcile",
					this.deps.emit,
				)
				session.cursor.reset(latestEventId)
				session.needsFullSync = false
				this.logReadOnly(session, readOnlyLocal)
			}
			session.db.setMeta(LAST_RECONCILE_AT, String(nowSeconds()))
		} catch (error) {
			if (this.denyOnAccessError(error)) return
			log(this.deps.emit, "error", `Reconciliation failed: ${errorMessage(error)}`)
			fileEvent(this.deps.emit, "", `reconcile-error: ${errorMessage(error)}`)
		}
	}

	private async pollChanges(session: Session): Promise<void> {
		if (this.session !== session) return
		try {
			await this.pullChanges(session)
		} catch (error) {
			if (!this.denyOnAccessError(error)) {
				log(this.deps.emit, "warn", `Polling changes failed: ${errorMessage(error)}`)
			}
		}
	}

	private async pullChanges(session: Session): Promise<void> {
		while (this.session === session) {
			const since = session.seenEventId ?? session.cursor.value ?? "0"
			let changes: RemoteChange[]
			try {
				changes = await listChanges(session.api, session.vaultId, since, CHANGES_PAGE_SIZE)
			} catch (error) {
				if (!isCursorExpired(error)) throw error
				await this.resyncFromScratch(session, "change feed cursor expired")
				return
			}
			for (const change of changes) this.acceptRemoteChange(session, change)
			if (changes.length < CHANGES_PAGE_SIZE) return
		}
	}

	private async resyncFromScratch(session: Session, reason: string): Promise<void> {
		if (this.session !== session) return
		log(this.deps.emit, "warn", `Running a full sync: ${reason}`)
		session.needsFullSync = true
		session.seenEventId = null
		await this.reconcile(session)
	}

	private acceptRemoteChange(session: Session, change: RemoteChange): void {
		if (change.id) {
			const seen = Number(session.seenEventId ?? "0")
			if (Number(change.id) > seen) session.seenEventId = change.id
		}
		const planned = planRemoteChange(change, this.deps.deviceId(), this.preferences)
		if (!session.access.canRead(change.path)) {
			const movedOutOfReach =
				change.type === "file_renamed" && change.oldPath && session.access.canRead(change.oldPath)
			if (movedOutOfReach && change.oldPath) {
				this.queueRemoteOp(session, { type: "delete", path: change.oldPath }, change.id)
			} else if (change.id) {
				this.markEventProcessed(session, change.id)
			}
			return
		}
		if (planned.metadata) session.db.upsertNoteMetadata(change.path, planned.metadata)
		if (!planned.op) {
			if (change.id) this.markEventProcessed(session, change.id)
			return
		}
		this.queueRemoteOp(session, planned.op, change.id)
	}

	private queueRemoteOp(session: Session, op: SyncOp, sourceEventId: string | null): void {
		try {
			session.queue.push(op, sourceEventId)
			this.scheduleDrain()
		} catch (error) {
			log(this.deps.emit, "warn", `Skipping queued remote event: ${errorMessage(error)}`)
		}
	}

	private markEventProcessed(session: Session, eventId: string): void {
		try {
			session.cursor.markProcessed(eventId)
		} catch (error) {
			log(this.deps.emit, "warn", `Skipping sync cursor advancement: ${errorMessage(error)}`)
		}
	}

	private push(op: SyncOp): void {
		this.session?.queue.push(op)
		this.scheduleDrain()
	}

	private scheduleDrain(): void {
		if (this.drainScheduled || !this.session) return
		this.drainScheduled = true
		this.serial(async () => {
			this.drainScheduled = false
			const session = this.session
			if (!session) return
			const downloads = session.queue.popWhile("download", DOWNLOAD_DRAIN_BATCH)
			if (downloads.length > 1) {
				await this.executeDownloads(session, downloads)
			} else {
				const item = downloads[0] ?? session.queue.pop()
				if (!item) return
				await this.execute(session, item)
			}
			if (this.session === session && session.queue.size > 0) this.scheduleDrain()
		})
	}

	private async execute(session: Session, item: QueueItem): Promise<void> {
		if (shouldIgnoreSyncPath(opTargetPath(item.op), this.preferences)) {
			this.complete(session, item)
			return
		}
		try {
			await executeOp(session, item.op, this.deps.emit)
			this.complete(session, item)
		} catch (error) {
			this.fail(session, item, error)
		}
	}

	private async executeDownloads(session: Session, items: QueueItem[]): Promise<void> {
		const byPath = new Map<string, QueueItem>()
		const pending: Array<{ path: string; version: number }> = []
		for (const item of items) {
			if (item.op.type !== "download") continue
			const { path, version } = item.op
			if (
				shouldIgnoreSyncPath(path, this.preferences) ||
				!transfer.needsDownload(session, path, version)
			) {
				this.complete(session, item)
				continue
			}
			byPath.set(path, item)
			pending.push({ path, version })
		}
		await downloadMany(
			session,
			pending,
			this.deps.emit,
			(path, error) => {
				const item = byPath.get(path)
				if (!item || this.session !== session) return
				if (error) this.fail(session, item, error)
				else this.complete(session, item)
			},
			() => this.session !== session,
		)
	}

	private complete(session: Session, item: QueueItem): void {
		session.queue.complete(item)
		if (item.sourceEventId) this.markEventProcessed(session, item.sourceEventId)
	}

	private fail(session: Session, item: QueueItem, error: unknown): void {
		if (this.denyOnAccessError(error, "path")) return
		const throttle = throttleDelayMs(error)
		if (throttle !== null) {
			log(this.deps.emit, "warn", `${opPath(item.op)} deferred: the server asked to retry later`)
			session.queue.defer(item, throttle / 1000)
			return
		}
		if (isPayloadTooLarge(error)) {
			log(this.deps.emit, "warn", `${opPath(item.op)} not synced: larger than the server limit`)
			fileEvent(this.deps.emit, opPath(item.op), "skipped: larger than the server limit")
			session.queue.fail(item, false)
			if (item.sourceEventId) this.markEventProcessed(session, item.sourceEventId)
			return
		}
		if (isPathForbidden(error)) {
			log(this.deps.emit, "warn", `${opPath(item.op)} skipped: no access on the server`)
			session.queue.fail(item, false)
			if (item.sourceEventId) this.markEventProcessed(session, item.sourceEventId)
			return
		}
		log(this.deps.emit, "error", `Sync operation failed: ${errorMessage(error)}`)
		const retrying = session.queue.fail(item, shouldRetry(error))
		if (!retrying && item.sourceEventId) this.markEventProcessed(session, item.sourceEventId)
	}

	private async onLocalChange(path: string): Promise<void> {
		const session = this.session
		const relative = this.relativePath(path)
		if (!session || !relative || shouldIgnoreSyncPath(relative, this.preferences)) return
		if (this.isCollabFollower(relative) || !session.access.canRead(relative)) return
		const writable = session.access.canWrite(relative)
		const now = Date.now()
		try {
			const fullPath = resolveInVault(session.vaultPath, relative)
			const stats = await syncRuntime().fs.stat(fullPath)
			if (!stats.isFile()) return
			const state = session.db.getFileState(relative)
			if (state?.syncStatus === "conflict") return
			if (state?.localMtime === Math.trunc(stats.mtimeMs) && state.localSize === stats.size) return
			if (!writable && !state) {
				this.logReadOnly(session, [relative])
				return
			}
			if (writable && this.pendingDeletes.size > 0) {
				const hash = hashBytes(await syncRuntime().fs.readFile(fullPath))
				if (state?.localHash === hash) return
				for (const [oldPath, pending] of this.pendingDeletes) {
					if (now - pending.at > DELETE_CORRELATION_WINDOW_MS || pending.hash !== hash) continue
					this.pendingDeletes.delete(oldPath)
					this.push({ type: "renameRemote", oldPath, newPath: relative })
					return
				}
			}
		} catch {
			return
		}
		this.pendingUploads.set(relative, now)
	}

	private onLocalDelete(path: string): void {
		const relative = this.relativePath(path)
		if (!this.session || !relative || shouldIgnoreSyncPath(relative, this.preferences)) return
		if (this.isCollabFollower(relative)) return
		if (!this.session.access.canWrite(relative)) {
			if (this.session.access.canRead(relative) && this.session.db.getFileState(relative)) {
				this.pendingUploads.set(relative, Date.now())
			}
			return
		}
		this.pendingUploads.delete(relative)
		const hash = this.session.db.getFileState(relative)?.localHash ?? null
		this.pendingDeletes.set(relative, { at: Date.now(), hash })
	}

	private flushPending(): void {
		const session = this.session
		if (!session) return
		const now = Date.now()
		for (const [path, pending] of this.pendingDeletes) {
			if (now - pending.at <= DELETE_CORRELATION_WINDOW_MS) continue
			this.pendingDeletes.delete(path)
			if (!shouldIgnoreSyncPath(path, this.preferences)) this.push({ type: "deleteRemote", path })
		}
		for (const [path, at] of this.pendingUploads) {
			if (now - at < UPLOAD_DEBOUNCE_MS) continue
			this.pendingUploads.delete(path)
			if (!shouldIgnoreSyncPath(path, this.preferences)) this.push({ type: "upload", path })
		}
	}

	private updatePreferences(preferences: SyncPreferences): void {
		const previous = this.preferences
		this.preferences = preferences
		for (const path of this.pendingUploads.keys()) {
			if (shouldIgnoreSyncPath(path, preferences)) this.pendingUploads.delete(path)
		}
		for (const path of this.pendingDeletes.keys()) {
			if (shouldIgnoreSyncPath(path, preferences)) this.pendingDeletes.delete(path)
		}
		const session = this.session
		if (!session) return
		for (const [file, key] of Object.entries(CORTEX_SYNCABLE_FILES)) {
			if (!previous[key] && preferences[key]) this.push({ type: "upload", path: `.cortex/${file}` })
		}
	}

	async handleRequest(request: RpcRequest<WorkerMethods>): Promise<unknown> {
		const session = this.session
		try {
			return await this.handleRpc(request)
		} catch (error) {
			if (session && this.session === session && accessDenial(error, "path")) {
				this.serial(() => {
					if (this.session === session) this.denyOnAccessError(error, "path")
				})
			}
			throw error
		}
	}

	private async handleRpc(request: RpcRequest<WorkerMethods>): Promise<unknown> {
		switch (request.method) {
			case "getConflicts": {
				const db = this.dbFor(request.args.vaultPath)
				return db ? await getAllConflicts(db, request.args.vaultPath) : []
			}
			case "getNoteMetadata": {
				const { vaultPath, filePath } = request.args
				const db = this.dbFor(vaultPath)
				const relative = toVaultRelativePath(filePath, vaultPath) ?? normalizeRelativePath(filePath)
				return db?.getNoteMetadata(relative) ?? null
			}
			case "getVersionHistory": {
				const ctx = await this.contextFor(request.args.vault)
				return await transfer.getVersionHistory(ctx, request.args.filePath)
			}
			case "downloadVersion": {
				const ctx = await this.contextFor(request.args.vault)
				const content = await transfer.downloadVersion(
					ctx,
					request.args.filePath,
					Number(request.args.version),
				)
				return utf8Decode(content)
			}
			case "restoreVersion": {
				const ctx = await this.contextFor(request.args.vault)
				await transfer.restoreVersion(ctx, request.args.filePath, Number(request.args.version))
				return null
			}
			case "listDeletedFiles":
				return await transfer.listDeletedFiles(await this.contextFor(request.args.vault))
			case "restoreDeletedFile": {
				const ctx = await this.contextFor(request.args.vault)
				await transfer.restoreDeletedFile(ctx, request.args.filePath)
				return null
			}
			case "getKeyTrustIssues":
				return this.keyTrustIssues(request.args.vaultId)
			case "trustMemberKey": {
				const { vaultId, userId, fingerprint } = request.args
				this.trustMemberKey(vaultId, userId, fingerprint)
				return null
			}
			case "shutdown":
				await this.shutdown()
				return null
		}
	}

	/** Lets queued work settle, then checkpoints and closes every open `sync.db`. */
	async shutdown(): Promise<void> {
		await this.lane
		this.closeSession()
		this.cachedDb?.close()
		this.cachedDb = null
		this.setState("idle")
	}

	private async contextFor(vault: VaultRef): Promise<SyncContext> {
		const session = this.session
		if (
			session &&
			session.vaultId === vault.vaultId &&
			resolvePath(session.vaultPath) === resolvePath(vault.vaultPath)
		) {
			return session
		}
		const vek = await this.deps.loadVek(vault.vaultId)
		if (!vek) throw new Error("Vault encryption key not available. Unlock the vault first.")
		const db = this.dbFor(vault.vaultPath) ?? new SyncDb(vault.vaultPath)
		this.releaseDb(db)
		return {
			api: new ApiClient(vault.serverUrl, {
				deviceId: this.deps.deviceId(),
				tokens: this.deps.tokens,
			}),
			db,
			vaultId: vault.vaultId,
			vaultPath: vault.vaultPath,
			vek,
			access: (() => {
				const cached = readCachedAccess(db)
				return cached ? accessFor(cached) : READ_ONLY_ACCESS
			})(),
		}
	}
}
