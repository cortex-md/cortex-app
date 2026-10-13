import {
	createDefaultSyncPreferences,
	createVaultFromFolder,
	DEFAULT_VAULT_NAME,
	getDefaultVaultName,
	getErrorMessage,
	getRegistryOpenOptions,
	openVaultSession,
	resolvePickedFolder,
	useAppStore,
	useVaultStore,
} from "@cortex/core"
import type { SyncPreferences, VaultRegistryEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { useState } from "react"

import { goToFilesRoot } from "@/features/navigation/routes"
import { OnboardingIdentity } from "@/features/onboarding/OnboardingIdentity"
import { OnboardingSync } from "@/features/onboarding/OnboardingSync"
import { OnboardingWelcome } from "@/features/onboarding/OnboardingWelcome"
import { SignInSheet } from "@/features/onboarding/SignInSheet"
import { getVaultColorOptions, vaultIconOptions } from "@/features/onboarding/vaultAppearance"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

type OnboardingStep = "welcome" | "identity" | "sync"
type PickMode = "create" | "open"

export interface PendingVaultFolder {
	path: string
	defaultName: string
}

interface OnboardingScreenProps {
	startupError?: string | null
	initialFolder?: PendingVaultFolder | null
	onCancel?: () => void
	onCreated?: () => void
}

interface OnboardingStatus {
	error: string | null
	submitting: boolean
}

async function runOnboardingTask(
	setStatus: (status: OnboardingStatus) => void,
	task: () => Promise<void>,
): Promise<void> {
	setStatus({ error: null, submitting: true })
	try {
		await task()
		setStatus({ error: null, submitting: false })
	} catch (error) {
		setStatus({ error: getErrorMessage(error), submitting: false })
	}
}

async function persistVaultColor(uuid: string, color: string): Promise<void> {
	await getPlatform()
		.vault.patchVaultRegistry?.(uuid, { color })
		.catch(() => undefined)
}

export function OnboardingScreen({
	startupError,
	initialFolder,
	onCancel,
	onCreated,
}: OnboardingScreenProps) {
	const { colors } = useMobileColors()
	const firstRunOnboardingSeen = useAppStore((state) => state.firstRunOnboardingSeen)
	const recentVaults = useVaultStore((state) => state.recentVaults)
	const [step, setStep] = useState<OnboardingStep>(initialFolder ? "identity" : "welcome")
	const [folderPath, setFolderPath] = useState(initialFolder?.path ?? null)
	const [name, setName] = useState(initialFolder?.defaultName ?? DEFAULT_VAULT_NAME)
	const [icon, setIcon] = useState(vaultIconOptions[0].icon)
	const [color, setColor] = useState(() => getVaultColorOptions(colors)[0].hex)
	const [preferences, setPreferences] = useState<SyncPreferences>(() =>
		createDefaultSyncPreferences(),
	)
	const [status, setStatus] = useState<OnboardingStatus>({
		error: startupError ?? null,
		submitting: false,
	})
	const [signInVisible, setSignInVisible] = useState(false)
	const visibleRecents = firstRunOnboardingSeen === false ? [] : recentVaults

	function finish() {
		if (!onCreated) return
		onCreated()
		goToFilesRoot()
	}

	function openRecent(entry: VaultRegistryEntry) {
		void runOnboardingTask(setStatus, async () => {
			await openVaultSession(entry.path, getRegistryOpenOptions(entry))
			finish()
		})
	}

	function chooseFolder(mode: PickMode) {
		triggerSelectionHaptic()
		void runOnboardingTask(setStatus, async () => {
			const picked = await getPlatform().dialog.pickFolder()
			if (!picked) return
			if (mode === "open") {
				const resolved = await resolvePickedFolder(picked)
				if (resolved.kind === "existing") {
					await openVaultSession(resolved.entry.path, getRegistryOpenOptions(resolved.entry))
					finish()
					return
				}
				setName(resolved.defaultName)
			} else {
				setName(await getDefaultVaultName(picked))
			}
			setFolderPath(picked)
			setStep("identity")
		})
	}

	function createVault() {
		if (!folderPath) {
			setStatus({ error: "Choose a folder before creating a vault.", submitting: false })
			setStep("welcome")
			return
		}
		void runOnboardingTask(setStatus, async () => {
			const vault = await createVaultFromFolder(folderPath, {
				icon,
				name,
				syncPreferences: preferences,
			})
			await persistVaultColor(vault.uuid, color)
			finish()
		})
	}

	if (step === "identity") {
		return (
			<OnboardingIdentity
				color={color}
				icon={icon}
				name={name}
				onBack={onCancel && initialFolder ? onCancel : () => setStep("welcome")}
				onChangeColor={setColor}
				onChangeIcon={setIcon}
				onChangeName={setName}
				onContinue={() => setStep("sync")}
			/>
		)
	}

	if (step === "sync") {
		return (
			<OnboardingSync
				onBack={() => setStep("identity")}
				onChange={setPreferences}
				onCreate={createVault}
				preferences={preferences}
				submitting={status.submitting}
			/>
		)
	}

	return (
		<>
			<OnboardingWelcome
				error={status.error}
				onCreate={() => chooseFolder("create")}
				onOpen={() => chooseFolder("open")}
				onOpenRecent={openRecent}
				onSignIn={() => setSignInVisible(true)}
				recentVaults={visibleRecents}
				submitting={status.submitting}
			/>
			<SignInSheet onClose={() => setSignInVisible(false)} visible={signInVisible} />
		</>
	)
}
