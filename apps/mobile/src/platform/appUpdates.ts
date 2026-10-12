import type { Platform } from "@cortex/platform"

import { getCurrentAppVersion } from "./app"

async function getUnsupportedUpdateStatus() {
	return {
		contentLength: null,
		currentVersion: await getCurrentAppVersion(),
		downloaded: 0,
		lastCheckedAt: null,
		lastError: "Expo updates are not wired in Cortex Mobile yet",
		pendingUpdate: null,
		state: "unsupported" as const,
	}
}

export const appUpdatesApi = {
	checkForUpdate: getUnsupportedUpdateStatus,
	fetchChangelog: async () => null,
	getStatus: getUnsupportedUpdateStatus,
	installUpdate: getUnsupportedUpdateStatus,
} satisfies Platform["appUpdates"]
