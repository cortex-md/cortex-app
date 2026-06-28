import { type FileEntry, getPlatform } from "@cortex/platform"
import {
	disablePlugin,
	getCommunityPluginLoadError,
	pluginStore,
	unregisterCommunityPlugin,
} from "@cortex/plugin-host-core"
import { getThemeManager, parseCommunityThemeManifest } from "@cortex/theme"
import { fetchLatestRelease } from "./registryService"
import type { GitHubRelease, GitHubReleaseAsset, RegistryEntry } from "./types"

interface PluginManifestFile {
	id?: unknown
	main?: unknown
}

class MissingReleaseAssetsError extends Error {}

async function downloadAsset(asset: GitHubReleaseAsset, destPath: string): Promise<void> {
	await getPlatform().fs.downloadFile(asset.browser_download_url, destPath)
}

function findAsset(assets: GitHubReleaseAsset[], name: string): GitHubReleaseAsset | undefined {
	return assets.find((a) => a.name === name)
}

function joinPath(...segments: string[]): string {
	return segments
		.flatMap((segment, index) => {
			const normalizedSegment =
				index === 0 ? segment.replace(/\/+$/g, "") : segment.replace(/^\/+|\/+$/g, "")
			return normalizedSegment ? [normalizedSegment] : []
		})
		.join("/")
}

function getPathBasename(path: string): string {
	const normalized = path.replaceAll("\\", "/")
	const parts = normalized.split("/").filter(Boolean)
	return parts.at(-1) ?? normalized
}

function getPathDirname(path: string): string {
	const normalized = path.replaceAll("\\", "/")
	const index = normalized.lastIndexOf("/")
	return index === -1 ? "" : normalized.slice(0, index)
}

function normalizeRelativePath(path: string, description = "plugin main"): string {
	const normalized = path.replaceAll("\\", "/").trim()
	const segments = normalized.split("/").filter((segment) => segment && segment !== ".")
	if (
		normalized.length === 0 ||
		normalized.startsWith("/") ||
		/^[a-zA-Z]:/.test(normalized) ||
		segments.length === 0 ||
		segments.some((segment) => segment === "..")
	) {
		throw new Error(`Invalid ${description} path: ${path}`)
	}
	return segments.join("/")
}

function parsePluginManifest(raw: string, entry: RegistryEntry): string {
	let manifest: PluginManifestFile
	try {
		manifest = JSON.parse(raw) as PluginManifestFile
	} catch {
		throw new Error(`Release for ${entry.id} contains invalid manifest.json`)
	}

	if (manifest.id !== entry.id) {
		throw new Error(`Release manifest id must be "${entry.id}"`)
	}
	if (typeof manifest.main !== "string") {
		throw new Error(`Release manifest for ${entry.id} is missing a valid main field`)
	}

	return normalizeRelativePath(manifest.main)
}

function findMainAsset(
	assets: GitHubReleaseAsset[],
	mainPath: string,
): GitHubReleaseAsset | undefined {
	return findAsset(assets, mainPath) ?? findAsset(assets, getPathBasename(mainPath))
}

async function safeDelete(path: string): Promise<void> {
	try {
		await getPlatform().fs.deleteFile(path)
	} catch {}
}

async function directoryContainsEntry(dirPath: string, entryName: string): Promise<boolean> {
	try {
		const entries = await getPlatform().fs.listDir(dirPath)
		return entries.some((entry) => entry.name === entryName)
	} catch {
		return false
	}
}

function prepareSourceFallbackInstall(
	stagingDir: string,
	sourceDir: string,
	entry: RegistryEntry,
	release: GitHubRelease,
): Promise<void> {
	return safeDelete(stagingDir)
		.then(() => getPlatform().fs.createDir(stagingDir))
		.then(() => installPluginFromSourceArchive(entry, release, sourceDir, stagingDir))
}

function assertCommunityPluginLoaded(pluginId: string): void {
	if (pluginId in pluginStore.getState().plugins) return
	const loadError = getCommunityPluginLoadError(pluginId)
	throw new Error(
		loadError
			? `Plugin ${pluginId} was downloaded but could not be loaded: ${loadError}`
			: `Plugin ${pluginId} was downloaded but could not be loaded. Check manifest.main and the bundle format.`,
	)
}

async function readFirstExisting(
	paths: string[],
): Promise<{ path: string; content: string } | null> {
	const reads = await Promise.all(
		Array.from(new Set(paths)).map(async (path) => {
			try {
				return { path, content: await getPlatform().fs.readFile(path) }
			} catch {
				return null
			}
		}),
	)
	return reads.find((result) => result !== null) ?? null
}

async function findFileByName(rootDir: string, name: string): Promise<string | null> {
	let entries: FileEntry[]
	try {
		entries = await getPlatform().fs.listDir(rootDir)
	} catch {
		return null
	}

	for (const entry of entries) {
		if (!entry.isDir && entry.name === name) return entry.path
	}

	const nestedMatches = await Promise.all(
		entries.flatMap((entry) => (entry.isDir ? [findFileByName(entry.path, name)] : [])),
	)
	const nested = nestedMatches.find((match) => match !== null)
	if (nested) return nested

	return null
}

async function installPluginFromReleaseAssets(
	entry: RegistryEntry,
	release: GitHubRelease,
	stagingDir: string,
): Promise<void> {
	const manifestAsset = findAsset(release.assets, "manifest.json")
	if (!manifestAsset) {
		throw new MissingReleaseAssetsError(`Release for ${entry.id} is missing manifest.json`)
	}

	await downloadAsset(manifestAsset, `${stagingDir}/manifest.json`)
	const manifestContent = await getPlatform().fs.readFile(`${stagingDir}/manifest.json`)
	const main = parsePluginManifest(manifestContent, entry)

	const mainAsset = findMainAsset(release.assets, main)
	if (!mainAsset) {
		throw new MissingReleaseAssetsError(`Release for ${entry.id} is missing ${main}`)
	}

	await downloadAsset(mainAsset, joinPath(stagingDir, main))

	const stylesAsset = findAsset(release.assets, "styles.css")
	if (stylesAsset) {
		await downloadAsset(stylesAsset, `${stagingDir}/styles.css`)
	}
}

async function installPluginFromSourceArchive(
	entry: RegistryEntry,
	release: GitHubRelease,
	sourceDir: string,
	stagingDir: string,
): Promise<void> {
	if (!release.zipball_url) {
		throw new Error(`Release for ${entry.id} is missing downloadable assets and zipball_url`)
	}

	await getPlatform().fs.downloadAndExtract(release.zipball_url, sourceDir)

	const manifestPath = await findFileByName(sourceDir, "manifest.json")
	if (!manifestPath) {
		throw new Error(`Source archive for ${entry.id} is missing manifest.json`)
	}

	const manifestContent = await getPlatform().fs.readFile(manifestPath)
	const main = parsePluginManifest(manifestContent, entry)
	const manifestDir = getPathDirname(manifestPath)
	const mainFile = await readFirstExisting([joinPath(manifestDir, main), joinPath(sourceDir, main)])
	const fallbackMainPath = mainFile ? null : await findFileByName(sourceDir, getPathBasename(main))
	const fallbackMain = fallbackMainPath
		? { path: fallbackMainPath, content: await getPlatform().fs.readFile(fallbackMainPath) }
		: null
	const resolvedMain = mainFile ?? fallbackMain
	if (!resolvedMain) {
		throw new Error(`Source archive for ${entry.id} is missing ${main}`)
	}

	await getPlatform().fs.writeFile(`${stagingDir}/manifest.json`, manifestContent)
	await getPlatform().fs.writeFile(joinPath(stagingDir, main), resolvedMain.content)

	let stylesFile = await readFirstExisting([
		joinPath(manifestDir, "styles.css"),
		joinPath(sourceDir, "styles.css"),
	])
	if (!stylesFile) {
		const stylesPath = await findFileByName(sourceDir, "styles.css")
		if (stylesPath) {
			stylesFile = await readFirstExisting([stylesPath])
		}
	}
	if (stylesFile) {
		await getPlatform().fs.writeFile(`${stagingDir}/styles.css`, stylesFile.content)
	}
}

export async function installPlugin(
	entry: RegistryEntry,
	pluginsDir: string,
	reloadPluginHost: (dir: string) => Promise<void>,
): Promise<void> {
	const release = await fetchLatestRelease(entry.repo)
	const destDir = `${pluginsDir}/${entry.id}`
	const workspaceDir = `${pluginsDir}/.${entry.id}-install-${Date.now()}`
	const stagingDir = `${workspaceDir}/plugin`
	const backupDir = `${workspaceDir}/previous`
	const sourceDir = `${workspaceDir}/source`
	let previousPluginMoved = false
	let stagedPluginPromoted = false

	await safeDelete(workspaceDir)
	await getPlatform().fs.createDir(stagingDir)
	try {
		try {
			await installPluginFromReleaseAssets(entry, release, stagingDir)
		} catch (error) {
			if (!(error instanceof MissingReleaseAssetsError)) throw error
			await prepareSourceFallbackInstall(stagingDir, sourceDir, entry, release)
		}

		if (await directoryContainsEntry(pluginsDir, entry.id)) {
			await getPlatform().fs.renameFile(destDir, backupDir)
			previousPluginMoved = true
		}
		await getPlatform().fs.renameFile(stagingDir, destDir)
		stagedPluginPromoted = true

		await reloadPluginHost(pluginsDir)
		assertCommunityPluginLoaded(entry.id)
		await safeDelete(workspaceDir)
	} catch (error) {
		if (stagedPluginPromoted) await safeDelete(destDir)
		if (previousPluginMoved) {
			await getPlatform().fs.renameFile(backupDir, destDir)
			try {
				await reloadPluginHost(pluginsDir)
			} catch {}
		} else if (stagedPluginPromoted) {
			unregisterCommunityPlugin(entry.id)
		}
		await safeDelete(workspaceDir)
		throw error
	}
}

export async function uninstallPlugin(id: string, pluginsDir: string): Promise<void> {
	const destDir = `${pluginsDir}/${id}`
	await disablePlugin(id)
	await getPlatform().fs.deleteFile(destDir)
	unregisterCommunityPlugin(id)
}

export async function installTheme(
	entry: RegistryEntry,
	themesDir: string,
	reloadCommunityThemes: (dir: string) => Promise<void>,
): Promise<void> {
	const release = await fetchLatestRelease(entry.repo)
	const destDir = `${themesDir}/${entry.id}`
	const workspaceDir = `${themesDir}/.${entry.id}-install-${Date.now()}`
	const stagingDir = `${workspaceDir}/theme`
	const backupDir = `${workspaceDir}/previous`
	let previousThemeMoved = false
	let stagedThemePromoted = false

	await safeDelete(workspaceDir)
	await getPlatform().fs.createDir(stagingDir)
	try {
		const manifestAsset = findAsset(release.assets, "manifest.json")
		if (!manifestAsset) {
			throw new Error(`Release for ${entry.id} is missing manifest.json`)
		}
		await downloadAsset(manifestAsset, `${stagingDir}/manifest.json`)

		const manifestContent = await getPlatform().fs.readFile(`${stagingDir}/manifest.json`)
		const manifest = parseCommunityThemeManifest(manifestContent)
		if (manifest.id !== entry.id) {
			throw new Error(`Release manifest id must be "${entry.id}"`)
		}

		await Promise.all(
			Object.entries(manifest.colorschemes).map(async ([colorScheme, cssFile]) => {
				const normalizedCssFile = normalizeRelativePath(cssFile, "theme stylesheet")
				const cssAsset =
					findAsset(release.assets, normalizedCssFile) ??
					findAsset(release.assets, getPathBasename(normalizedCssFile)) ??
					findAsset(release.assets, `${colorScheme}.css`)
				if (!cssAsset) {
					throw new Error(
						`Release for ${entry.id} is missing colorscheme asset: ${colorScheme}.css`,
					)
				}
				const destination = joinPath(stagingDir, normalizedCssFile)
				await downloadAsset(cssAsset, destination)
			}),
		)

		const installedThemes = await getPlatform().fs.listDir(themesDir)
		if (installedThemes.some((theme) => theme.name === entry.id)) {
			await getPlatform().fs.renameFile(destDir, backupDir)
			previousThemeMoved = true
		}

		await getPlatform().fs.renameFile(stagingDir, destDir)
		stagedThemePromoted = true
		await reloadCommunityThemes(themesDir)
		await safeDelete(workspaceDir)
	} catch (error) {
		if (stagedThemePromoted) await safeDelete(destDir)
		if (previousThemeMoved) {
			await getPlatform().fs.renameFile(backupDir, destDir)
			try {
				await reloadCommunityThemes(themesDir)
			} catch {}
		}
		await safeDelete(workspaceDir)
		throw error
	}
}

export async function uninstallTheme(id: string, themesDir: string): Promise<void> {
	const destDir = `${themesDir}/${id}`
	let familyName = id
	try {
		const manifest = parseCommunityThemeManifest(
			await getPlatform().fs.readFile(`${destDir}/manifest.json`),
		)
		familyName = manifest.name
	} catch {}
	await getPlatform().fs.deleteFile(destDir)
	getThemeManager().unregisterTheme(familyName)
}
