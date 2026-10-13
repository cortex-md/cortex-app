import {
	createDefaultSyncPreferences,
	createVaultFolder,
	createVaultFromFolder,
	getRegistryOpenOptions,
	openVaultSession,
	resolvePickedFolder,
	useAppStore,
	useVaultStore,
} from "@cortex/core"
import type { SyncPreferences, VaultRegistryEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"
import { type ReactNode, useState } from "react"
import { Alert, Platform, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { goToFilesRoot } from "@/features/navigation/routes"
import { OnboardingIdentity } from "@/features/onboarding/OnboardingIdentity"
import { OnboardingSync } from "@/features/onboarding/OnboardingSync"
import { OnboardingWelcome } from "@/features/onboarding/OnboardingWelcome"
import { SignInSheet } from "@/features/onboarding/SignInSheet"
import { DEFAULT_VAULT_COLOR, vaultIconOptions } from "@/features/onboarding/vaultAppearance"
import { openRegisteredVault, useVaultAccess } from "@/features/vault/vaultAccess"
import { showVaultError } from "@/features/vault/vaultErrors"
import { useMobileColors } from "@/hooks/useMobileColors"
import { getMobileVaultFolderName } from "@/platform/vaultAccess"
import { triggerSelectionHaptic } from "@/utils/haptics"

type OnboardingStep = "welcome" | "identity" | "sync"

export interface PendingVaultFolder {
	path: string
	name: string
}

interface OnboardingScreenProps {
	startupError?: string | null
	initialFolder?: PendingVaultFolder | null
	onCreated?: () => void
	renderChrome?: (title: string) => ReactNode
}

async function runOnboardingTask(
	setBusy: (busy: boolean) => void,
	errorTitle: string,
	task: () => Promise<void>,
): Promise<void> {
	setBusy(true)
	try {
		await task()
	} catch (error) {
		showVaultError(errorTitle, error)
	} finally {
		setBusy(false)
	}
}

async function persistVaultColor(uuid: string, color: string): Promise<void> {
	await getPlatform()
		.vault.patchVaultRegistry?.(uuid, { color })
		.catch(() => undefined)
}

function confirmReauthorize(entry: VaultRegistryEntry, onConfirm: () => void): void {
	Alert.alert(
		`Reauthorize “${entry.name}”`,
		`Choose the “${entry.name}” folder again so Cortex can open it.`,
		[
			{ style: "cancel", text: "Cancel" },
			{ isPreferred: true, onPress: onConfirm, text: "Reauthorize" },
		],
	)
}

function confirmForgetMissing(entry: VaultRegistryEntry, onConfirm: () => void): void {
	Alert.alert(`“${entry.name}” was not found`, "The vault folder is no longer on this device.", [
		{ style: "cancel", text: "Cancel" },
		{ onPress: onConfirm, style: "destructive", text: "Remove from list" },
	])
}

export function OnboardingScreen({
	startupError,
	initialFolder,
	onCreated,
	renderChrome,
}: OnboardingScreenProps) {
	const { colors } = useMobileColors()
	const insets = useSafeAreaInsets()
	const firstRunOnboardingSeen = useAppStore((state) => state.firstRunOnboardingSeen)
	const recentVaults = useVaultStore((state) => state.recentVaults)
	const removeRecentVault = useVaultStore((state) => state.removeRecentVault)
	const [step, setStep] = useState<OnboardingStep>(initialFolder ? "identity" : "welcome")
	const [folderPath, setFolderPath] = useState<string | null>(initialFolder?.path ?? null)
	const [initialName, setInitialName] = useState(initialFolder?.name ?? "")
	const [name, setName] = useState(initialFolder?.name ?? "")
	const [icon, setIcon] = useState(vaultIconOptions[0].value)
	const [color, setColor] = useState(DEFAULT_VAULT_COLOR)
	const [preferences, setPreferences] = useState<SyncPreferences>(() =>
		createDefaultSyncPreferences(),
	)
	const [busy, setBusy] = useState(false)
	const [signInVisible, setSignInVisible] = useState(false)
	const [accessGeneration, setAccessGeneration] = useState(0)
	const visibleRecents = firstRunOnboardingSeen === false ? [] : recentVaults
	const access = useVaultAccess(visibleRecents, accessGeneration)
	const showTitle = !renderChrome

	function finish() {
		if (!onCreated) return
		onCreated()
		goToFilesRoot()
	}

	function openRecent(entry: VaultRegistryEntry) {
		void runOnboardingTask(setBusy, `Couldn't open “${entry.name}”`, async () => {
			const opened = await openRegisteredVault(entry)
			setAccessGeneration((value) => value + 1)
			if (opened) finish()
		})
	}

	function selectRecent(entry: VaultRegistryEntry) {
		triggerSelectionHaptic()
		const state = access.get(entry.uuid)
		if (state === "needsAccess") {
			confirmReauthorize(entry, () => openRecent(entry))
			return
		}
		if (state === "missing") {
			confirmForgetMissing(entry, () => void removeRecentVault(entry.uuid))
			return
		}
		openRecent(entry)
	}

	function startCreate() {
		triggerSelectionHaptic()
		setFolderPath(null)
		setInitialName("")
		setName("")
		setStep("identity")
	}

	function openFolder() {
		triggerSelectionHaptic()
		void runOnboardingTask(setBusy, "Couldn't open the folder", async () => {
			const picked = await getPlatform().dialog.pickFolder()
			if (!picked) return
			const resolved = await resolvePickedFolder(picked)
			if (resolved.kind === "existing") {
				await openVaultSession(resolved.entry.path, getRegistryOpenOptions(resolved.entry))
				finish()
				return
			}
			const folderName = (await getMobileVaultFolderName(picked)) ?? ""
			setFolderPath(picked)
			setInitialName(folderName)
			setName(folderName)
			setStep("identity")
		})
	}

	function createVault() {
		const vaultName = name.trim()
		if (!vaultName) {
			setStep("identity")
			return
		}
		void runOnboardingTask(setBusy, "Couldn't create the vault", async () => {
			const path = folderPath ?? (await createVaultFolder(null, vaultName))
			setFolderPath(path)
			const vault = await createVaultFromFolder(path, {
				icon,
				name: vaultName,
				syncPreferences: preferences,
			})
			await persistVaultColor(vault.uuid, color)
			if (!folderPath) {
				await useSettingsStore.getState().updateSetting("editor", "showLineNumbers", false)
			}
			finish()
		})
	}

	const title = step === "sync" ? "Sync preferences" : step === "identity" ? "New vault" : "Cortex"
	let content: ReactNode
	if (step === "identity") {
		content = (
			<OnboardingIdentity
				color={color}
				fieldKey={folderPath ?? "new"}
				icon={icon}
				initialName={initialName}
				name={name}
				onBack={initialFolder ? undefined : () => setStep("welcome")}
				onChangeColor={setColor}
				onChangeIcon={setIcon}
				onChangeName={setName}
				onContinue={() => setStep("sync")}
				showTitle={showTitle}
			/>
		)
	} else if (step === "sync") {
		content = (
			<OnboardingSync
				busy={busy}
				onBack={() => setStep("identity")}
				onChange={setPreferences}
				onCreate={createVault}
				preferences={preferences}
				showTitle={showTitle}
			/>
		)
	} else {
		content = (
			<>
				<OnboardingWelcome
					access={access}
					busy={busy}
					notice={startupError ?? null}
					onCreate={startCreate}
					onOpen={openFolder}
					onOpenRecent={selectRecent}
					onSignIn={() => setSignInVisible(true)}
					recentVaults={visibleRecents}
				/>
				<SignInSheet onClose={() => setSignInVisible(false)} visible={signInVisible} />
			</>
		)
	}

	return (
		<View
			style={[
				styles.root,
				{ backgroundColor: colors.groupedBackground },
				Platform.OS === "android" && showTitle ? { paddingTop: insets.top } : null,
			]}
		>
			{renderChrome?.(title)}
			{content}
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
})
