import { homedir } from "node:os"
import { join } from "node:path"
import { app } from "electron"
import { detectInstallType, type InstallType } from "./installType"

export function detectCurrentInstallType(): InstallType {
	return detectInstallType({
		platform: process.platform,
		isPackaged: app.isPackaged,
		execPath: process.execPath,
		env: process.env,
		inApplicationsFolder: process.platform === "darwin" && app.isInApplicationsFolder(),
	})
}

/** The per-user OS cache folder; Electron has no `app.getPath` name for it. */
export function userCacheDir(): string | null {
	switch (process.platform) {
		case "darwin":
			return join(homedir(), "Library", "Caches")
		case "win32":
			return process.env.LOCALAPPDATA ?? null
		case "linux":
			return process.env.XDG_CACHE_HOME || join(homedir(), ".cache")
		default:
			return null
	}
}
