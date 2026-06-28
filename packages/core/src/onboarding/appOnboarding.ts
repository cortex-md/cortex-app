import { getPlatform } from "@cortex/platform"

export interface FirstRunOnboardingMarker {
	version: number
	firstRunOnboardingSeenAt: string
}

const appOnboardingMarkerFileName = "onboarding.json"

async function getAppOnboardingMarkerPath(): Promise<string> {
	const appDataDir = await getPlatform().storage.getAppDataDir()
	return `${appDataDir}/${appOnboardingMarkerFileName}`
}

export async function readFirstRunOnboardingSeen(): Promise<boolean> {
	try {
		await getPlatform().fs.readFile(await getAppOnboardingMarkerPath())
		return true
	} catch {
		return false
	}
}

export async function writeFirstRunOnboardingSeen(now = new Date()): Promise<void> {
	const platform = getPlatform()
	const appDataDir = await platform.storage.getAppDataDir()
	const marker: FirstRunOnboardingMarker = {
		version: 1,
		firstRunOnboardingSeenAt: now.toISOString(),
	}
	await platform.fs.createDir(appDataDir)
	await platform.fs.writeFile(
		`${appDataDir}/${appOnboardingMarkerFileName}`,
		JSON.stringify(marker, null, 2),
	)
}
