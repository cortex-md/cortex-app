import type { AppUpdateInstallMode } from "@cortex/platform"
import type { UpdatePackage } from "../manifest"

export interface InstallerContext {
	version: string
	stagingDir: string
	pid: number
}

export interface PreparedUpdate {
	packagePath: string
	version: string
}

export interface UpdateInstaller {
	readonly kind: string
	readonly mode: AppUpdateInstallMode
	/** False when the update is only announced with a link to the release page. */
	readonly downloads: boolean
	/** Throws an `UpdateError` before any download when this install cannot be replaced. */
	preflight(): Promise<void>
	/** Where the verified package is written; AppImage downloads next to the running file. */
	downloadPath(entry: UpdatePackage, context: InstallerContext): string
	/** Runs after the hash matched: extract and validate, never touching the installed app. */
	prepare(packagePath: string, context: InstallerContext): Promise<PreparedUpdate>
	/** Hands off to a detached process, or the user, then the caller quits the app. */
	install(prepared: PreparedUpdate, context: InstallerContext): Promise<{ quit: boolean }>
}
