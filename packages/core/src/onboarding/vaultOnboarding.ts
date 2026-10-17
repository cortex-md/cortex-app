import { getPlatform } from "@cortex/platform"
import { toVaultRelativePath } from "@cortex/platform/utils"
import { createNoteWithPropertyDefaults } from "@cortex/properties"
import { getLocalVaultState } from "../vault/vaultStateFiles"
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

async function hasVaultOnboardingMarker(vaultPath: string): Promise<boolean> {
	return (await getLocalVaultState(vaultPath).read()).onboarding !== null
}

export async function ensureVaultOnboardingNote(
	vaultPath: string,
	now = new Date(),
): Promise<VaultOnboardingResult> {
	if (await hasVaultOnboardingMarker(vaultPath)) {
		return { created: false, notePath: null }
	}

	const platform = getPlatform()
	const [notePath, content] = await Promise.all([
		resolveOnboardingNotePath(vaultPath),
		createNoteWithPropertyDefaults(vaultPath, DEFAULT_VAULT_ONBOARDING_NOTE),
	])
	const marker: VaultOnboardingMarker = {
		version: 1,
		notePath: toVaultRelativePath(notePath, vaultPath) ?? notePath,
		createdAt: now.toISOString(),
	}

	await platform.fs.writeFile(notePath, content)
	await getLocalVaultState(vaultPath).update((state) => ({ ...state, onboarding: { ...marker } }), {
		immediate: true,
	})
	return { created: true, notePath }
}
