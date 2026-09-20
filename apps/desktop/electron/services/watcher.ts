import { watch, type FSWatcher } from "chokidar"
import { basename } from "node:path"
import { emitToRenderer } from "../events"
import { normalizePath } from "../paths"

interface WatcherRecord {
	watcher: FSWatcher
	includeHidden: boolean
}

const watchers = new Map<string, WatcherRecord>()
let nextId = 1

const IGNORED_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"])

function isHiddenPath(path: string): boolean {
	return path.split(/[/\\]/).some((part) => part.startsWith("."))
}

function eventKind(event: string): string | null {
	switch (event) {
		case "add":
		case "addDir":
			return "created"
		case "change":
			return "modified"
		case "unlink":
		case "unlinkDir":
			return "deleted"
		default:
			return null
	}
}

export async function startWatching(
	path: string,
	includeHidden = false,
	followSymlinks = false,
): Promise<string> {
	const watcherId = `watcher-${nextId}`
	nextId += 1

	const watcher = watch(path, {
		ignoreInitial: true,
		persistent: true,
		followSymlinks,
		awaitWriteFinish: {
			stabilityThreshold: 100,
			pollInterval: 50,
		},
	})

	const emitChange = (eventName: string, changedPath: string) => {
		const kind = eventKind(eventName)
		if (!kind) return
		const filename = basename(changedPath)
		if (IGNORED_NAMES.has(filename)) return
		if (!includeHidden && isHiddenPath(changedPath)) return
		emitToRenderer("vault-file-changed", {
			path: normalizePath(changedPath),
			kind,
			watcherId,
		})
	}

	watcher.on("add", (changedPath) => emitChange("add", changedPath))
	watcher.on("addDir", (changedPath) => emitChange("addDir", changedPath))
	watcher.on("change", (changedPath) => emitChange("change", changedPath))
	watcher.on("unlink", (changedPath) => emitChange("unlink", changedPath))
	watcher.on("unlinkDir", (changedPath) => emitChange("unlinkDir", changedPath))

	watchers.set(watcherId, { watcher, includeHidden })
	return watcherId
}

export async function stopWatching(watcherId: string): Promise<void> {
	const record = watchers.get(watcherId)
	if (!record) return
	await record.watcher.close()
	watchers.delete(watcherId)
}
