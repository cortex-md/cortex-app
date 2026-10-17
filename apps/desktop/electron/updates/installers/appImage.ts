import { chmod, rename } from "node:fs/promises"
import { dirname } from "node:path"
import type { UpdatePackage } from "../manifest"
import { appImageUpdatePath } from "../staging"
import { assertWritable, spawnDetached } from "./process"
import type { InstallerContext, PreparedUpdate, UpdateInstaller } from "./types"

// Relaunching before this process exits would lose the single-instance lock race.
const RELAUNCH_AFTER_EXIT = 'while kill -0 "$1" 2>/dev/null; do sleep 0.1; done; exec "$2"'

export class AppImageInstaller implements UpdateInstaller {
	readonly kind = "appimage"
	readonly downloads = true
	readonly mode = "automatic" as const

	constructor(private readonly appImagePath: string) {}

	async preflight(): Promise<void> {
		await assertWritable([dirname(this.appImagePath)])
	}

	downloadPath(_entry: UpdatePackage, context: InstallerContext): string {
		return appImageUpdatePath(this.appImagePath, context.version)
	}

	async prepare(packagePath: string, context: InstallerContext): Promise<PreparedUpdate> {
		await chmod(packagePath, 0o755)
		return { packagePath, version: context.version }
	}

	async install(prepared: PreparedUpdate, context: InstallerContext): Promise<{ quit: boolean }> {
		await rename(prepared.packagePath, this.appImagePath)
		await spawnDetached("/bin/sh", [
			"-c",
			RELAUNCH_AFTER_EXIT,
			"cortex-update",
			String(context.pid),
			this.appImagePath,
		])
		return { quit: true }
	}
}
