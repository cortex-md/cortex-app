import type { AppUpdateInstallMode } from "@cortex/platform"
import { shell } from "electron"
import { UpdateError } from "../errors"
import { releasePageUrl, type UpdatePackage } from "../manifest"
import type { InstallerContext, PreparedUpdate, UpdateInstaller } from "./types"

/** Package-manager installs (deb, rpm, snap, flatpak) only link to the release page. */
export class ReleasePageInstaller implements UpdateInstaller {
	readonly kind = "release-page"
	readonly downloads = false

	constructor(
		readonly mode: AppUpdateInstallMode,
		private readonly reason: string,
	) {}

	async preflight(): Promise<void> {
		throw new UpdateError("UNSUPPORTED_INSTALL_TYPE", this.reason)
	}

	downloadPath(_entry: UpdatePackage, _context: InstallerContext): string {
		throw new UpdateError("UNSUPPORTED_INSTALL_TYPE", this.reason)
	}

	async prepare(): Promise<PreparedUpdate> {
		throw new UpdateError("UNSUPPORTED_INSTALL_TYPE", this.reason)
	}

	async install(prepared: PreparedUpdate): Promise<{ quit: boolean }> {
		await shell.openExternal(releasePageUrl(prepared.version))
		return { quit: false }
	}
}
