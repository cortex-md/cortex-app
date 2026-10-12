import { type FSWatcher, promises as fs, watch } from "node:fs"
import { join, relative } from "node:path"
import type { WatchEvent, WatchOptions } from "@cortex/platform"
import { normalizePath } from "@cortex/platform/utils"
import { isHiddenVaultPath } from "@cortex/platform/vault"
import { webContents } from "electron"
import { EVENT_CHANNEL_PREFIX } from "../contract"
import { getInvokeSender } from "../ipc/sender"
import { notifyLocalFileChange } from "./syncBridge"

const SETTLE_DELAY_MS = 100

interface VaultWatcher {
	watcher: FSWatcher
	ownerId: number | null
	pending: Map<string, { timer: NodeJS.Timeout; changed: boolean }>
}

const watchers = new Map<string, VaultWatcher>()
let nextWatcherId = 1

export function startWatching(root: string, options: WatchOptions): string {
	const watcherId = `watcher-${nextWatcherId++}`
	const ownerId = getInvokeSender()?.id ?? null
	const includeHidden = options.includeHidden ?? false
	const pending: VaultWatcher["pending"] = new Map()

	const emit = (absolutePath: string, kind: WatchEvent["kind"], isFile: boolean) => {
		if (!isHiddenVaultPath(relative(root, absolutePath), { includeHidden })) {
			const owner = ownerId === null ? null : webContents.fromId(ownerId)
			owner?.send(`${EVENT_CHANNEL_PREFIX}vault-file-changed`, {
				path: normalizePath(absolutePath),
				kind,
				watcherId,
			})
		}
		if (isFile || kind === "deleted") notifyLocalFileChange(absolutePath, kind)
	}

	const settle = async (absolutePath: string, changed: boolean) => {
		pending.delete(absolutePath)
		const stats = await fs.stat(absolutePath).catch(() => null)
		if (!watchers.has(watcherId)) return
		if (!stats) emit(absolutePath, "deleted", false)
		else emit(absolutePath, changed && stats.isFile() ? "modified" : "created", stats.isFile())
	}

	const watcher = watch(root, { recursive: true }, (eventType, fileName) => {
		if (!fileName) return
		const relativePath = fileName.toString()
		if (isHiddenVaultPath(relativePath, { includeHidden: true })) return
		const absolutePath = join(root, relativePath)
		const previous = pending.get(absolutePath)
		if (previous) clearTimeout(previous.timer)
		const changed = (previous?.changed ?? true) && eventType === "change"
		pending.set(absolutePath, {
			changed,
			timer: setTimeout(() => void settle(absolutePath, changed), SETTLE_DELAY_MS),
		})
	})

	watcher.on("error", (error) => {
		console.warn(`[watcher] ${root}:`, error)
	})

	watchers.set(watcherId, { watcher, ownerId, pending })
	return watcherId
}

export async function stopWatching(watcherId: string): Promise<void> {
	const entry = watchers.get(watcherId)
	if (!entry) return
	watchers.delete(watcherId)
	for (const { timer } of entry.pending.values()) clearTimeout(timer)
	entry.watcher.close()
}

export async function stopWatchersFor(ownerId: number): Promise<void> {
	const owned = [...watchers].filter(([, entry]) => entry.ownerId === ownerId)
	await Promise.all(owned.map(([watcherId]) => stopWatching(watcherId)))
}
