import type { AppUpdateState, AppUpdateStatus } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"

export const APP_UPDATE_STATE_LABELS: Record<AppUpdateState, string> = {
	idle: "Not checked yet",
	checking: "Checking for updates",
	"up-to-date": "Cortex is up to date",
	available: "Update available",
	downloading: "Downloading update",
	verifying: "Verifying update",
	ready: "Update ready",
	installing: "Installing update",
	error: "Update failed",
	unsupported: "Updates unavailable",
}

export function getDownloadProgress(status: AppUpdateStatus): number | null {
	if (!status.contentLength || status.contentLength <= 0) return null
	return Math.min(100, Math.round((status.downloaded / status.contentLength) * 100))
}

export function isAppUpdateBusy(status: AppUpdateStatus): boolean {
	return (
		status.state === "checking" ||
		status.state === "downloading" ||
		status.state === "verifying" ||
		status.state === "installing"
	)
}

/** A package-manager install or a fallback where the user finishes the update. */
export function needsManualInstall(status: AppUpdateStatus): boolean {
	return status.installMode === "manual" && status.pendingUpdate !== null
}

export function canMoveToApplications(status: AppUpdateStatus): boolean {
	return status.lastError?.code === "NOT_IN_APPLICATIONS"
}

export function openAppUpdateDownloadPage(status: AppUpdateStatus): void {
	const url = status.pendingUpdate?.downloadUrl
	if (url) void getPlatform().app.openExternalUrl(url)
}
