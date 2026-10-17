import { readdir, readFile, rm, rmdir, stat, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import type { InstallType } from "./installType"
import type { UpdatePackage } from "./manifest"
import { compareSemVer, isNewerVersion, parseSemVer } from "./version"

const PREPARED_MARKER = "prepared.json"
const APPIMAGE_SUFFIXES = [".update", ".update.part"] as const

/** Every place the updater writes to, so cleanup can account for all of it. */
export interface StagingLayout {
	root: string
	appImagePath: string | null
	macBundlePath: string | null
}

/** Written after a package was hashed and prepared, so later launches skip re-reading it. */
export interface PreparedMarker {
	version: string
	sha256: string
	size: number
	preparedPath: string
}

export function stagingLayoutFor(installType: InstallType, userDataDir: string): StagingLayout {
	return {
		root: join(userDataDir, "updates"),
		appImagePath: installType.kind === "appimage" ? installType.appImagePath : null,
		macBundlePath: installType.kind === "mac-app" ? installType.bundlePath : null,
	}
}

export function appImageUpdatePath(appImagePath: string, version: string): string {
	return join(dirname(appImagePath), `.${basename(appImagePath)}.${version}.update`)
}

function appImageUpdateVersion(appImagePath: string, entry: string): string | null {
	const prefix = `.${basename(appImagePath)}.`
	if (!entry.startsWith(prefix)) return null
	const suffix = APPIMAGE_SUFFIXES.find((candidate) => entry.endsWith(candidate))
	return suffix ? entry.slice(prefix.length, -suffix.length) : null
}

function macBackupPath(bundlePath: string): string {
	return join(dirname(bundlePath), `.${basename(bundlePath)}.backup`)
}

async function exists(path: string): Promise<boolean> {
	try {
		await stat(path)
		return true
	} catch {
		return false
	}
}

async function readEntries(directory: string): Promise<string[]> {
	try {
		return await readdir(directory)
	} catch {
		return []
	}
}

async function remove(path: string, removed: string[]): Promise<void> {
	try {
		await rm(path, { recursive: true, force: true })
		removed.push(path)
	} catch (error) {
		console.warn(`[updates] could not remove ${path}:`, error)
	}
}

/** The newest staged version above the running one: a download that may resume after a restart. */
export async function newestStagedVersion(
	layout: StagingLayout,
	currentVersion: string,
): Promise<string | null> {
	const versions = (await readEntries(layout.root))
		.filter((entry) => isNewerVersion(entry, currentVersion))
		.flatMap((entry) => {
			const parsed = parseSemVer(entry)
			return parsed ? [{ entry, parsed }] : []
		})
		.sort((left, right) => compareSemVer(right.parsed, left.parsed))
	return versions[0]?.entry ?? null
}

/**
 * Deletes everything the updater created except the files of `keepVersion`: older and superseded
 * staging folders, leftover AppImage downloads next to the running file, and a stale macOS backup
 * bundle. Removes the staging root itself once it is empty. Returns the removed paths.
 */
export async function cleanStaging(
	layout: StagingLayout,
	keepVersion: string | null,
): Promise<string[]> {
	const removed: string[] = []
	const stagedEntries = await readEntries(layout.root)
	await Promise.all(
		stagedEntries
			.filter((entry) => entry !== keepVersion)
			.map((entry) => remove(join(layout.root, entry), removed)),
	)
	if (stagedEntries.length > 0 && (await readEntries(layout.root)).length === 0) {
		await rmdir(layout.root).catch(() => {})
	}

	const appImagePath = layout.appImagePath
	if (appImagePath) {
		const directory = dirname(appImagePath)
		const leftovers = (await readEntries(directory)).filter((entry) => {
			const version = appImageUpdateVersion(appImagePath, entry)
			return version !== null && version !== keepVersion
		})
		await Promise.all(leftovers.map((entry) => remove(join(directory, entry), removed)))
	}

	if (layout.macBundlePath) {
		const backup = macBackupPath(layout.macBundlePath)
		if (await exists(backup)) await remove(backup, removed)
	}

	return removed
}

export async function writePreparedMarker(
	stagingDir: string,
	marker: PreparedMarker,
): Promise<void> {
	await writeFile(join(stagingDir, PREPARED_MARKER), JSON.stringify(marker))
}

/** Returns the prepared path when the marker matches this package and the file is still there. */
export async function readPreparedPackage(
	stagingDir: string,
	version: string,
	entry: UpdatePackage,
): Promise<string | null> {
	let marker: Partial<PreparedMarker>
	try {
		marker = JSON.parse(await readFile(join(stagingDir, PREPARED_MARKER), "utf8"))
	} catch {
		return null
	}
	const matches =
		marker.version === version &&
		marker.sha256 === entry.sha256 &&
		marker.size === entry.size &&
		typeof marker.preparedPath === "string"
	if (!matches || !marker.preparedPath || !(await exists(marker.preparedPath))) return null
	return marker.preparedPath
}
