import { basename, join } from "node:path"
import type { UpdatePackage } from "../manifest"
import { assertWritable, spawnDetached } from "./process"
import type { InstallerContext, PreparedUpdate, UpdateInstaller } from "./types"

/** electron-builder NSIS flags: `--updated` closes the running app, `--force-run` relaunches it. */
export function nsisInstallerArgs(scope: "user" | "machine"): string[] {
	return scope === "user" ? ["--updated", "/S", "--force-run"] : ["--updated", "--force-run"]
}

export class WindowsNsisInstaller implements UpdateInstaller {
	readonly kind = "windows-nsis"
	readonly downloads = true
	readonly mode

	constructor(
		private readonly scope: "user" | "machine",
		private readonly installDir: string,
	) {
		this.mode = scope === "user" ? ("automatic" as const) : ("manual" as const)
	}

	async preflight(): Promise<void> {
		if (this.scope === "user") await assertWritable([this.installDir])
	}

	downloadPath(entry: UpdatePackage, context: InstallerContext): string {
		return join(context.stagingDir, decodeURIComponent(basename(new URL(entry.url).pathname)))
	}

	async prepare(packagePath: string, context: InstallerContext): Promise<PreparedUpdate> {
		return { packagePath, version: context.version }
	}

	async install(prepared: PreparedUpdate): Promise<{ quit: boolean }> {
		await spawnDetached(prepared.packagePath, nsisInstallerArgs(this.scope))
		return { quit: true }
	}
}
