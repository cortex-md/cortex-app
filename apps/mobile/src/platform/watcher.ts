import type { Platform, WatchEvent } from "@cortex/platform"
import { getBaseName, toVaultRelativePath } from "@cortex/platform/utils"
import { isHiddenVaultPath } from "@cortex/platform/vault"
import type { Directory, WatchEvent as ExpoFileSystemWatchEvent, File } from "expo-file-system"

import { normalizeUri } from "./appStorage"
import { getMobileVaultPathParts } from "./mobile-vault-paths"
import { resolveEntry } from "./pathResolver"
import { noopUnsubscribe } from "./unsupported"
import { mapActualUriToLogicalPath } from "./vaultRoots"

async function toWatchEvent(
	event: ExpoFileSystemWatchEvent<File | Directory>,
): Promise<WatchEvent> {
	const actualUri = normalizeUri(event.target.uri)
	const logicalPath = await mapActualUriToLogicalPath(actualUri)
	return {
		kind: event.type,
		path: logicalPath ?? actualUri,
		watcherId: logicalPath ?? actualUri,
	}
}

function getWatchRelativePath(eventPath: string, watchedPath: string): string {
	return (
		getMobileVaultPathParts(eventPath)?.relativePath ??
		toVaultRelativePath(eventPath, watchedPath) ??
		getBaseName(eventPath)
	)
}

export const watcherApi = {
	startWatching: async (path, callback, options) => {
		const entry = await resolveEntry(path)
		if (normalizeUri(entry.entry.uri).startsWith("content://")) {
			return noopUnsubscribe
		}

		let subscription: { remove: () => void }
		try {
			subscription = entry.entry.watch((event) => {
				void toWatchEvent(event)
					.then((normalizedEvent) => {
						const relativePath = getWatchRelativePath(normalizedEvent.path, path)
						if (isHiddenVaultPath(relativePath, { includeHidden: options?.includeHidden })) return
						callback(normalizedEvent)
					})
					.catch((error) => {
						console.error("[Cortex Mobile watcher event failed]", error)
					})
			})
		} catch (error) {
			console.warn("[Cortex Mobile watcher unsupported]", { error, path })
			return noopUnsubscribe
		}

		return () => subscription.remove()
	},
} satisfies Pick<Platform["fs"], "startWatching">
