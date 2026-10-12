import { relative } from "node:path"
import type { WatchEvent, WatchOptions } from "@cortex/platform"
import { normalizePath } from "@cortex/platform/utils"
import { isHiddenVaultPath } from "@cortex/platform/vault"
import { type FSWatcher, watch } from "chokidar"
import { webContents } from "electron"
import { EVENT_CHANNEL_PREFIX } from "../contract"
import { getInvokeSender } from "../ipc/sender"
import { notifyLocalFileChange } from "./syncBridge"

const EVENT_KINDS: Record<string, WatchEvent["kind"]> = {
	add: "created",
	addDir: "created",
	change: "modified",
	unlink: "deleted",
	unlinkDir: "deleted",
}

const watchers = new Map<string, { watcher: FSWatcher; ownerId: number | null }>()
let nextWatcherId = 1

export function startWatching(root: string, options: WatchOptions): string {
	const watcherId = `watcher-${nextWatcherId++}`
	const ownerId = getInvokeSender()?.id ?? null
	const includeHidden = options.includeHidden ?? false
	const watcher = watch(root, {
		ignoreInitial: true,
		followSymlinks: options.followSymlinks ?? false,
		ignored: (path) => isHiddenVaultPath(relative(root, path), { includeHidden: true }),
		awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
	})

	watcher.on("all", (eventName, changedPath) => {
		const kind = EVENT_KINDS[eventName]
		if (!kind) return
		if (!isHiddenVaultPath(relative(root, changedPath), { includeHidden })) {
			const owner = ownerId === null ? null : webContents.fromId(ownerId)
			owner?.send(`${EVENT_CHANNEL_PREFIX}vault-file-changed`, {
				path: normalizePath(changedPath),
				kind,
				watcherId,
			})
		}
		if (eventName === "add" || eventName === "change" || eventName === "unlink") {
			notifyLocalFileChange(changedPath, kind)
		}
	})

	watcher.on("error", (error) => {
		console.warn(`[watcher] ${root}:`, error)
	})

	watchers.set(watcherId, { watcher, ownerId })
	return watcherId
}

export async function stopWatching(watcherId: string): Promise<void> {
	const entry = watchers.get(watcherId)
	if (!entry) return
	watchers.delete(watcherId)
	await entry.watcher.close()
}

export async function stopWatchersFor(ownerId: number): Promise<void> {
	const owned = [...watchers].filter(([, entry]) => entry.ownerId === ownerId)
	await Promise.all(owned.map(([watcherId]) => stopWatching(watcherId)))
}
