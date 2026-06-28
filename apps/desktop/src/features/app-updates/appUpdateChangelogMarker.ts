import { getPlatform } from "@cortex/platform"

interface AppUpdateChangelogMarker {
	version: number
	lastSeenAppVersion: string
	lastSeenAt: string
}

const appUpdateChangelogMarkerFileName = "app-updates.json"

async function getAppUpdateChangelogMarkerPath(): Promise<string> {
	const appDataDir = await getPlatform().storage.getAppDataDir()
	return `${appDataDir}/${appUpdateChangelogMarkerFileName}`
}

export async function readLastSeenAppVersion(): Promise<string | null> {
	try {
		const content = await getPlatform().fs.readFile(await getAppUpdateChangelogMarkerPath())
		const marker = JSON.parse(content) as Partial<AppUpdateChangelogMarker>
		return typeof marker.lastSeenAppVersion === "string" ? marker.lastSeenAppVersion : null
	} catch {
		return null
	}
}

export async function writeLastSeenAppVersion(version: string, now = new Date()): Promise<void> {
	const platform = getPlatform()
	const appDataDir = await platform.storage.getAppDataDir()
	const marker: AppUpdateChangelogMarker = {
		version: 1,
		lastSeenAppVersion: version,
		lastSeenAt: now.toISOString(),
	}
	await platform.fs.createDir(appDataDir)
	await platform.fs.writeFile(
		`${appDataDir}/${appUpdateChangelogMarkerFileName}`,
		JSON.stringify(marker, null, 2),
	)
}
