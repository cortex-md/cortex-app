import { getPlatform } from "@cortex/platform"

interface MobileStartupState {
	lastActiveVaultPath?: string | null
}

const startupStateFileName = "mobile-startup.json"

async function getStartupStatePath(): Promise<string> {
	const appDataDir = await getPlatform().storage.getAppDataDir()
	return `${appDataDir}/${startupStateFileName}`
}

export async function readLastActiveVaultPath(): Promise<string | null> {
	try {
		const content = await getPlatform().fs.readFile(await getStartupStatePath())
		const state = JSON.parse(content) as MobileStartupState
		return state.lastActiveVaultPath ?? null
	} catch {
		return null
	}
}

export async function writeLastActiveVaultPath(path: string | null): Promise<void> {
	await getPlatform().fs.writeFile(
		await getStartupStatePath(),
		JSON.stringify({ lastActiveVaultPath: path }, null, "\t"),
	)
}
