import { getErrorMessage, useAccountStore, useAuthStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { Alert } from "react-native"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { accountServerLabel, useAccountServer } from "@/features/account/accountServer"
import { useHostedSyncEntitlement } from "@/features/billing/billingAdapter"
import { toast } from "@/features/feedback/useToast"
import { openSettings, presentSheet } from "@/features/navigation/routes"
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

export function AccountScreen() {
	const user = useAuthStore((state) => (state.authenticated ? state.user : null))
	const server = useAccountServer()
	const { planLabel } = useHostedSyncEntitlement()

	if (!user) {
		return (
			<NativeForm>
				<FormSection footer="An account syncs your vaults between devices and lets you share notes. Use Cortex Cloud or your own server.">
					<FormRow onPress={() => presentSheet("sign-in")} tint title="Sign in" />
					<FormRow
						onPress={() => presentSheet("sign-in", { mode: "create" })}
						tint
						title="Create account"
					/>
				</FormSection>
			</NativeForm>
		)
	}

	return (
		<NativeForm>
			<FormSection>
				<FormRow
					icon={{ md: "account_circle", sf: "person.crop.circle.fill" }}
					subtitle={user.email}
					title={user.displayName ?? user.email}
				/>
			</FormSection>
			<FormSection
				footer={server.selfHosted ? "Your own server. Sync is free and has no plan." : undefined}
				title="Server"
			>
				<FormRow title="Server" value={accountServerLabel(server)} />
				{server.selfHosted ? null : (
					<FormRow chevron onPress={() => openSettings("plan")} title="Plan" value={planLabel} />
				)}
			</FormSection>
			<FormSection title="Security">
				<FormRow chevron onPress={() => openSettings("password")} title="Change password" />
				<FormRow onPress={confirmRegenerateRecoveryKey} title="New recovery key" />
			</FormSection>
			<FormSection footer="To use another server, sign out and sign in again.">
				<FormRow destructive onPress={confirmSignOut} title="Sign out" />
			</FormSection>
		</NativeForm>
	)
}
