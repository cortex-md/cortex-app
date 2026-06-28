import { getPlatform } from "@cortex/platform"
import { createNoteWithPropertyDefaults } from "@cortex/properties"
import { DEFAULT_VAULT_ONBOARDING_NOTE } from "./defaultVaultOnboardingNote"

export interface VaultOnboardingMarker {
	version: number
	notePath: string
	createdAt: string
}

export interface VaultOnboardingResult {
	created: boolean
	notePath: string | null
}

const vaultOnboardingMarkerFileName = "onboarding.json"
const onboardingNoteBaseName = "Welcome to Cortex"
const onboardingNoteExtension = ".md"

async function fileExists(path: string): Promise<boolean> {
	try {
		await getPlatform().fs.readFile(path)
		return true
	} catch {
		return false
	}
}

function getOnboardingNotePath(vaultPath: string, suffix: number): string {
	const fileName =
		suffix === 1
			? `${onboardingNoteBaseName}${onboardingNoteExtension}`
			: `${onboardingNoteBaseName} ${suffix}${onboardingNoteExtension}`
	return `${vaultPath}/${fileName}`
}

async function resolveOnboardingNotePath(vaultPath: string): Promise<string> {
	let suffix = 1
	let candidate = getOnboardingNotePath(vaultPath, suffix)
	while (await fileExists(candidate)) {
		suffix++
		candidate = getOnboardingNotePath(vaultPath, suffix)
	}
	return candidate
}

async function getVaultOnboardingMarkerPath(vaultPath: string): Promise<string> {
	const configDir = await getPlatform().storage.getVaultConfigDir(vaultPath)
	return `${configDir}/${vaultOnboardingMarkerFileName}`
}

async function hasVaultOnboardingMarker(vaultPath: string): Promise<boolean> {
	try {
		await getPlatform().fs.readFile(await getVaultOnboardingMarkerPath(vaultPath))
		return true
	} catch {
		return false
	}
}

export async function ensureVaultOnboardingNote(
	vaultPath: string,
	now = new Date(),
): Promise<VaultOnboardingResult> {
	if (await hasVaultOnboardingMarker(vaultPath)) {
		return { created: false, notePath: null }
	}

	const platform = getPlatform()
	const [notePath, content, configDir] = await Promise.all([
		resolveOnboardingNotePath(vaultPath),
		createNoteWithPropertyDefaults(vaultPath, DEFAULT_VAULT_ONBOARDING_NOTE),
		platform.storage.getVaultConfigDir(vaultPath),
	])
	const marker: VaultOnboardingMarker = {
		version: 1,
		notePath: notePath.replace(`${vaultPath}/`, ""),
		createdAt: now.toISOString(),
	}

	await Promise.all([platform.fs.writeFile(notePath, content), platform.fs.createDir(configDir)])
	await platform.fs.writeFile(
		`${configDir}/${vaultOnboardingMarkerFileName}`,
		JSON.stringify(marker, null, 2),
	)
	return { created: true, notePath }
}
