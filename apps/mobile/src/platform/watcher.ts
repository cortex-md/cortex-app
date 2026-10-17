import type { Platform, WatchEvent } from "@cortex/platform"
import { getBaseName, isPathOrDescendant, toVaultRelativePath } from "@cortex/platform/utils"
import { isHiddenVaultPath } from "@cortex/platform/vault"
import type { Directory, WatchEvent as ExpoFileSystemWatchEvent, File } from "expo-file-system"

import { normalizeUri } from "./appStorage"
import { getMobileVaultPathParts } from "./mobile-vault-paths"
import { resolveEntry } from "./pathResolver"
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

interface WatchRegistration {
	path: string
	includeHidden: boolean
	callback: (event: WatchEvent) => void
}

const registrations = new Set<WatchRegistration>()

export function emitSyntheticWatchEvent(path: string, kind: WatchEvent["kind"]): void {
	for (const registration of registrations) {
		if (!isPathOrDescendant(path, registration.path)) continue
		const relativePath = getWatchRelativePath(path, registration.path)
		if (isHiddenVaultPath(relativePath, { includeHidden: registration.includeHidden })) continue
		registration.callback({ kind, path, watcherId: path })
	}
}

function register(registration: WatchRegistration): () => void {
	registrations.add(registration)
	return () => {
		registrations.delete(registration)
	}
}

export const watcherApi = {
	startWatching: async (path, callback, options) => {
		const unregister = register({
			callback,
			includeHidden: options?.includeHidden ?? false,
			path,
		})
		const entry = await resolveEntry(path)
		if (normalizeUri(entry.entry.uri).startsWith("content://")) {
			return unregister
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
			return unregister
		}

		return () => {
			unregister()
			subscription.remove()
		}
	},
} satisfies Pick<Platform["fs"], "startWatching">
