import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { SyncDb } from "@cortex/sync-engine"
import { type UtilityProcess, utilityProcess } from "electron"
import { emitToRenderer } from "../events"
import { getDeviceInfo } from "./device"
import * as keychain from "./keychain"

const require = createRequire(import.meta.url)

interface WorkerOutboundMessage {
	type: string
	id?: string
	method?: string
	account?: string
	value?: string
	args?: Record<string, unknown>
	command?: unknown
	result?: unknown
	error?: string
}

interface PendingInvoke {
	resolve: (value: unknown) => void
	reject: (error: Error) => void
}

let child: UtilityProcess | null = null
let ready: Promise<void> | null = null
const pending = new Map<string, PendingInvoke>()
let messageId = 0

function nextId(): string {
	messageId += 1
	return `sync-${messageId}`
}

function resolveWorkerEntry(): string {
	try {
		return require.resolve("@cortex/sync-engine/worker")
	} catch {
		const here = dirname(fileURLToPath(import.meta.url))
		return join(here, "../../../packages/sync-engine/src/worker.ts")
	}
}

function collectKeychainEntries(): Record<string, string> {
	const entries: Record<string, string> = {}
	for (const account of [
		"access_token",
		"refresh_token",
		"device_token",
		"server_url",
		"display_name",
		"user_id",
		"user_email",
		"user_display_name",
	]) {
		const value = keychain.get(account)
		if (value) entries[account] = value
	}
	return entries
}

function post(message: WorkerOutboundMessage): void {
	if (!child) throw new Error("Sync worker is not running")
	child.postMessage(message)
}

function request(message: Omit<WorkerOutboundMessage, "id">): Promise<unknown> {
	const id = nextId()
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject })
		post({ ...message, id })
	})
}

function handleWorkerMessage(raw: unknown): void {
	const message = raw as WorkerOutboundMessage
	switch (message.type) {
		case "ready":
		case "result": {
			if (!message.id) return
			const waiter = pending.get(message.id)
			if (!waiter) return
			pending.delete(message.id)
			if (message.error) waiter.reject(new Error(message.error))
			else waiter.resolve(message.result ?? null)
			return
		}
		case "event": {
			if (!message.method) return
			emitToRenderer(message.method, message.args)
			return
		}
		case "keychain": {
			try {
				if (message.method === "get" && message.account) {
					const result = keychain.get(message.account)
					if (message.id) {
						post({ type: "keychainResult", id: message.id, account: message.account, result })
					}
					return
				}
				if (message.method === "set" && message.account && typeof message.value === "string") {
					keychain.set(message.account, message.value)
					if (message.id) {
						post({ type: "keychainResult", id: message.id, account: message.account, result: null })
					}
					return
				}
				if (message.method === "delete" && message.account) {
					keychain.delete(message.account)
					if (message.id) {
						post({ type: "keychainResult", id: message.id, account: message.account, result: null })
					}
				}
			} catch (error) {
				if (message.id) {
					post({
						type: "keychainResult",
						id: message.id,
						error: error instanceof Error ? error.message : String(error),
					})
				}
			}
			return
		}
		default:
			return
	}
}

export async function ensureSyncWorker(): Promise<void> {
	if (ready) return await ready
	ready = (async () => {
		const entry = resolveWorkerEntry()
		child = utilityProcess.fork(entry, [], {
			serviceName: "cortex-sync-engine",
			stdio: "inherit",
		})
		child.on("message", handleWorkerMessage)
		child.on("exit", () => {
			child = null
			ready = null
			for (const waiter of pending.values()) {
				waiter.reject(new Error("Sync worker exited"))
			}
			pending.clear()
		})

		const deviceInfo = getDeviceInfo()
		await request({
			type: "bootstrap",
			args: {
				deviceId: deviceInfo.deviceId,
				deviceName: deviceInfo.deviceName,
				deviceType: deviceInfo.deviceType,
				keychainEntries: collectKeychainEntries(),
			},
		})
	})()
	await ready
}

function toEngineCommand(
	command: string,
	args: Record<string, unknown>,
): Record<string, unknown> | null {
	switch (command) {
		case "sync_start":
			return {
				type: "start",
				vaultId: args.vaultId,
				vaultPath: args.vaultPath,
				serverUrl: args.serverUrl,
				requiresEntitlement: Boolean(args.requiresEntitlement),
			}
		case "sync_stop":
			return { type: "stop" }
		case "sync_force_sync_file":
			return { type: "forceSyncFile", path: args.path }
		case "sync_resolve_conflict":
			return {
				type: "resolveConflict",
				path: args.path,
				resolution: args.resolution,
			}
		case "sync_update_preferences":
			return {
				type: "updateSyncPreferences",
				syncSettings: Boolean(args.syncSettings),
				syncHotkeys: Boolean(args.syncHotkeys),
				syncWorkspace: Boolean(args.syncWorkspace),
				syncPluginMetadata: Boolean(args.syncPluginMetadata),
				syncThemeMetadata: Boolean(args.syncThemeMetadata),
				syncBookmarks: Boolean(args.syncBookmarks),
				ignoreImages: Boolean(args.ignoreImages),
				excludedPaths: Array.isArray(args.excludedPaths) ? args.excludedPaths : [],
			}
		default:
			return null
	}
}

function getConflicts(vaultPath: string) {
	const db = SyncDb.open(vaultPath)
	try {
		return db
			.listAllSyncStates()
			.filter((row) => row.syncStatus === "conflict")
			.map((row) => ({
				path: row.filePath,
				localHash: row.localHash,
				remoteHash: row.remoteHash,
				ancestorHash: row.ancestorHash,
			}))
	} finally {
		db.close()
	}
}

export async function handleSyncInvoke(
	command: string,
	args: Record<string, unknown> = {},
): Promise<unknown> {
	if (!command.startsWith("sync_")) {
		throw new Error(`Not a sync command: ${command}`)
	}

	if (command === "sync_get_note_metadata") {
		const vaultPath = String(args.vaultPath ?? "")
		const filePath = String(args.filePath ?? "")
		const db = SyncDb.open(vaultPath)
		try {
			return db.getNoteMetadata(filePath)
		} finally {
			db.close()
		}
	}

	if (command === "sync_get_conflicts") {
		return getConflicts(String(args.vaultPath ?? ""))
	}

	if (command === "sync_check_vault_encryption") {
		return { hasKey: Boolean(keychain.get(`vek:${String(args.vaultId ?? "")}`)) }
	}

	if (command === "sync_create_vault_key") {
		keychain.set(`vek:${String(args.vaultId ?? "")}`, String(args.password ?? ""))
		return null
	}

	if (command === "sync_unlock_vault_key") {
		const vaultId = String(args.vaultId ?? "")
		const password = String(args.password ?? "")
		const stored = keychain.get(`vek:${vaultId}`)
		if (!stored || stored !== password) {
			throw new Error("Invalid vault encryption password")
		}
		return null
	}

	if (command === "sync_get_version_history" || command === "sync_list_deleted_files") {
		return []
	}

	await ensureSyncWorker()

	if (command === "sync_stop") {
		await request({ type: "command", command: { type: "stop" } })
		await stopSyncWorker()
		return null
	}

	const engineCommand = toEngineCommand(command, args)
	if (engineCommand) {
		await request({ type: "command", command: engineCommand })
		return null
	}

	throw new Error(`Sync command not yet implemented in Electron bridge: ${command}`)
}

export function isSyncCommand(command: string): boolean {
	return command.startsWith("sync_")
}

export async function stopSyncWorker(): Promise<void> {
	if (!child) return
	await request({ type: "stop" }).catch(() => undefined)
	child.kill()
	child = null
	ready = null
}
