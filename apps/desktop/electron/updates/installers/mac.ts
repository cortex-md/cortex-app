import { chmod, mkdir, readdir, rm, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import { shell } from "electron"
import { UpdateError } from "../errors"
import type { UpdatePackage } from "../manifest"
import { buildMacInstallScript } from "./macScript"
import { assertWritable, execFileAsync, spawnDetached } from "./process"
import type { InstallerContext, PreparedUpdate, UpdateInstaller } from "./types"

const BUNDLE_ID = "app.cortex.desktop"

async function readPlistValue(appPath: string, key: string): Promise<string> {
	const { stdout } = await execFileAsync("/usr/bin/plutil", [
		"-extract",
		key,
		"raw",
		"-o",
		"-",
		join(appPath, "Contents", "Info.plist"),
	])
	return stdout.trim()
}

async function extractApp(zipPath: string, context: InstallerContext): Promise<string> {
	const extractDir = join(context.stagingDir, "extracted")
	await rm(extractDir, { recursive: true, force: true })
	await mkdir(extractDir, { recursive: true })
	try {
		await execFileAsync("/usr/bin/ditto", ["-x", "-k", zipPath, extractDir])
	} catch (error) {
		throw new UpdateError("INSTALL_FAILED", "Could not extract the update package", {
			cause: error,
		})
	}
	const appName = (await readdir(extractDir)).find((entry) => entry.endsWith(".app"))
	if (!appName) throw new UpdateError("INSTALL_FAILED", "The update package has no app bundle")
	const appPath = join(extractDir, appName)
	const [version, bundleId] = await Promise.all([
		readPlistValue(appPath, "CFBundleShortVersionString"),
		readPlistValue(appPath, "CFBundleIdentifier"),
	])
	if (version !== context.version || bundleId !== BUNDLE_ID) {
		throw new UpdateError(
			"INSTALL_FAILED",
			`The update bundle is ${bundleId} ${version}, expected ${BUNDLE_ID} ${context.version}`,
		)
	}
	return appPath
}

export class MacZipInstaller implements UpdateInstaller {
	readonly kind = "mac-zip"
	readonly downloads = true
	readonly mode

	constructor(
		private readonly bundlePath: string,
		private readonly inApplications: boolean,
		private readonly automatic: boolean,
	) {
		this.mode = automatic ? ("automatic" as const) : ("manual" as const)
	}

	async preflight(): Promise<void> {
		if (!this.automatic) return
		if (!this.inApplications || this.bundlePath.includes("/AppTranslocation/")) {
			throw new UpdateError(
				"NOT_IN_APPLICATIONS",
				"Move Cortex to the Applications folder to install updates",
			)
		}
		await assertWritable([dirname(this.bundlePath), this.bundlePath])
	}

	downloadPath(entry: UpdatePackage, context: InstallerContext): string {
		return join(context.stagingDir, decodeURIComponent(basename(new URL(entry.url).pathname)))
	}

	/** Keeps only the extracted bundle: the verified zip is deleted so staging never holds both. */
	async prepare(packagePath: string, context: InstallerContext): Promise<PreparedUpdate> {
		const appPath = await extractApp(packagePath, context)
		await rm(packagePath, { force: true })
		return { packagePath: appPath, version: context.version }
	}

	async install(prepared: PreparedUpdate, context: InstallerContext): Promise<{ quit: boolean }> {
		if (!this.automatic) {
			shell.showItemInFolder(prepared.packagePath)
			return { quit: false }
		}
		const appDir = dirname(this.bundlePath)
		const appName = basename(this.bundlePath)
		const scriptPath = join(context.stagingDir, "install.sh")
		const script = buildMacInstallScript({
			pid: context.pid,
			currentAppPath: this.bundlePath,
			newAppPath: prepared.packagePath,
			backupAppPath: join(appDir, `.${appName}.backup`),
			logPath: join(context.stagingDir, "install.log"),
			executableName: await readPlistValue(prepared.packagePath, "CFBundleExecutable"),
		})
		await writeFile(scriptPath, script, { mode: 0o700 })
		await chmod(scriptPath, 0o700)
		await spawnDetached("/bin/sh", [scriptPath])
		return { quit: true }
	}
}
