import { getPlatform } from "@cortex/platform"

export interface FirstRunOnboardingMarker {
	version: number
	firstRunOnboardingSeenAt: string
	workspaceModeChosenAt?: string
}

export interface AppOnboardingState {
	firstRunOnboardingSeen: boolean
	workspaceModeChosen: boolean
}

const appOnboardingMarkerFileName = "onboarding.json"

async function getAppOnboardingMarkerPath(): Promise<string> {
	const appDataDir = await getPlatform().storage.getAppDataDir()
	return `${appDataDir}/${appOnboardingMarkerFileName}`
}

async function readMarker(): Promise<Partial<FirstRunOnboardingMarker> | null> {
	let content: string
	try {
		content = await getPlatform().fs.readFile(await getAppOnboardingMarkerPath())
	} catch {
		return null
	}
	try {
		const parsed = JSON.parse(content) as unknown
		return parsed && typeof parsed === "object" ? (parsed as Partial<FirstRunOnboardingMarker>) : {}
	} catch {
		return {}
	}
}

async function writeMarker(patch: Partial<FirstRunOnboardingMarker>, now: Date): Promise<void> {
	const platform = getPlatform()
	const appDataDir = await platform.storage.getAppDataDir()
	const current = (await readMarker()) ?? {}
	const marker: FirstRunOnboardingMarker = {
		...current,
		version: 1,
		firstRunOnboardingSeenAt: current.firstRunOnboardingSeenAt ?? now.toISOString(),
		...patch,
	}
	await platform.fs.createDir(appDataDir)
	await platform.fs.atomicWriteFile(
		`${appDataDir}/${appOnboardingMarkerFileName}`,
		JSON.stringify(marker, null, 2),
	)
}

export async function readAppOnboardingState(): Promise<AppOnboardingState> {
	const marker = await readMarker()
	return {
		firstRunOnboardingSeen: marker !== null,
		workspaceModeChosen: typeof marker?.workspaceModeChosenAt === "string",
	}
}

export async function readFirstRunOnboardingSeen(): Promise<boolean> {
	return (await readAppOnboardingState()).firstRunOnboardingSeen
}

export async function writeFirstRunOnboardingSeen(now = new Date()): Promise<void> {
	await writeMarker({}, now)
}

export async function writeWorkspaceModeChosen(now = new Date()): Promise<void> {
	await writeMarker({ workspaceModeChosenAt: now.toISOString() }, now)
}
