import { getErrorMessage, useAppStore, useAuthStore } from "@cortex/core"
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

export function GeneralSettingsScreen() {
	const version = useAppStore((state) => state.version)
	const autoOpenLastVault = useSettingsStore((state) => state.settings.general.autoOpenLastVault)
	const account = useAccountSummary()
	const { planLabel } = useHostedSyncEntitlement()

	return (
		<NativeForm>
			<FormSection title="Account">
				<FormRow subtitle={account.email} title={account.displayName} />
				<FormRow chevron onPress={() => openSettings("plan")} title="Plan" value={planLabel} />
				<FormRow destructive onPress={confirmSignOut} title="Sign out" />
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
