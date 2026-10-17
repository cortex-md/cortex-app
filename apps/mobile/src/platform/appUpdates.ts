import type { AppUpdateStatus, Platform } from "@cortex/platform"

import { getCurrentAppVersion } from "./app"

async function getUnsupportedUpdateStatus(): Promise<AppUpdateStatus> {
	return {
		contentLength: null,
		currentVersion: await getCurrentAppVersion(),
		downloaded: 0,
		installMode: "unsupported",
		installOnQuit: false,
		lastCheckedAt: null,
		lastError: null,
		pendingUpdate: null,
		state: "unsupported",
	}
}

export const appUpdatesApi = {
	checkForUpdate: getUnsupportedUpdateStatus,
	configure: getUnsupportedUpdateStatus,
	downloadUpdate: getUnsupportedUpdateStatus,
	fetchChangelog: async () => null,
	getStatus: getUnsupportedUpdateStatus,
	installNow: getUnsupportedUpdateStatus,
	onStatusChanged: () => () => {},
	setInstallOnQuit: getUnsupportedUpdateStatus,
} satisfies Platform["appUpdates"]
