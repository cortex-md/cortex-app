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
