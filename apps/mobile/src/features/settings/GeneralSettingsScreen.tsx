import { getErrorMessage, useAccountStore, useAppStore, useAuthStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"
import { Alert } from "react-native"

import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import { useAccountSummary, useHostedSyncEntitlement } from "@/features/billing/billingAdapter"
import { toast } from "@/features/feedback/useToast"
import { openSettings } from "@/features/navigation/routes"
import { updateSetting } from "@/features/settings/settingsPages"
import { DEVICE_LABEL } from "@/features/vault/useVaultListItems"

async function signOut(): Promise<void> {
	try {
		await useAuthStore.getState().logout()
		toast("Signed out")
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

function confirmSignOut(): void {
	Alert.alert(
		"Sign out of Cortex?",
		`Every vault stays on this ${DEVICE_LABEL}. Synced vaults stop syncing until you sign in again.`,
		[
			{ style: "cancel", text: "Cancel" },
			{ onPress: () => void signOut(), style: "destructive", text: "Sign out" },
		],
	)
}

async function regenerateRecoveryKey(): Promise<void> {
	try {
		const recoveryKey = await useAccountStore.getState().regenerateRecoveryKey()
		Alert.alert(
			"Your new recovery key",
			`${recoveryKey}\n\nStore it somewhere safe. The previous key no longer works.`,
			[
				{
					onPress: () => void getPlatform().clipboard.writeText(recoveryKey),
					text: "Copy",
				},
				{ style: "cancel", text: "Done" },
			],
		)
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

function confirmRegenerateRecoveryKey(): void {
	Alert.alert(
		"Create a new recovery key?",
		"The current recovery key stops working. Use the new one to get back into encrypted notes if you forget your password.",
		[
			{ style: "cancel", text: "Cancel" },
			{ onPress: () => void regenerateRecoveryKey(), text: "Create key" },
		],
	)
}

export function GeneralSettingsScreen() {
	const version = useAppStore((state) => state.version)
	const autoOpenLastVault = useSettingsStore((state) => state.settings.general.autoOpenLastVault)
	const account = useAccountSummary()
	const { planLabel } = useHostedSyncEntitlement()
	const authenticated = useAuthStore((state) => state.authenticated)

	return (
		<NativeForm>
			<FormSection title="Account">
				<FormRow subtitle={account.email} title={account.displayName} />
				<FormRow chevron onPress={() => openSettings("plan")} title="Plan" value={planLabel} />
				{authenticated ? (
					<>
						<FormRow chevron onPress={() => openSettings("password")} title="Change password" />
						<FormRow onPress={confirmRegenerateRecoveryKey} title="New recovery key" />
						<FormRow destructive onPress={confirmSignOut} title="Sign out" />
					</>
				) : null}
			</FormSection>
			<FormSection title="Startup">
				<FormToggle
					onValueChange={(value) => updateSetting("general", "autoOpenLastVault", value)}
					title="Open last vault on startup"
					value={autoOpenLastVault}
				/>
			</FormSection>
			<FormSection title="About">
				<FormRow title="Version" value={version ?? "0.2.0"} />
			</FormSection>
		</NativeForm>
	)
}
