import type { InstallType } from "../installType"
import { AppImageInstaller } from "./appImage"
import { MacZipInstaller } from "./mac"
import { ReleasePageInstaller } from "./releasePage"
import type { UpdateInstaller } from "./types"
import { WindowsNsisInstaller } from "./windows"

export type { InstallerContext, PreparedUpdate, UpdateInstaller } from "./types"

export function createInstaller(installType: InstallType, automatic = true): UpdateInstaller {
	switch (installType.kind) {
		case "mac-app":
			return new MacZipInstaller(installType.bundlePath, installType.inApplications, automatic)
		case "windows-nsis":
			return new WindowsNsisInstaller(
				automatic ? installType.scope : "machine",
				installType.installDir,
			)
		case "appimage":
			return automatic
				? new AppImageInstaller(installType.appImagePath)
				: new ReleasePageInstaller("manual", "The AppImage folder is not writable")
		case "linux-package":
			return new ReleasePageInstaller(
				"manual",
				`Updates for ${installType.manager} installs come from your package manager`,
			)
		case "dev":
			return new ReleasePageInstaller("unsupported", "Development builds do not update")
		case "unknown":
			return new ReleasePageInstaller(
				"manual",
				`Updates are not supported on ${installType.platform}`,
			)
	}
}
