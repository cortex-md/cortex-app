import { Stack } from "expo-router"
import { Alert } from "react-native"

import { FormSection, NativeForm } from "@/components/ui/Form"
import { FormButton, FormTextField } from "@/features/onboarding/FormControls"
import { finishSyncedVault } from "@/features/vault/addVaultActions"
import { useAddVault } from "@/features/vault/addVaultContext"
import { pushAddVaultStep } from "@/features/vault/addVaultNavigation"
import { isNewRemote, localVaultName, validatePassword } from "@/features/vault/addVaultState"

export function AddVaultPasswordScreen() {
	const { patch, state } = useAddVault()
	const isNew = isNewRemote(state)
	const target = isNew ? state.newRemoteName.trim() || localVaultName(state) : state.remoteName
	const label = isNew
		? "Create and sync"
		: state.path === "download"
			? "Unlock and download"
			: "Unlock and sync"

	async function submit() {
		const error = validatePassword(state)
		if (error) {
			Alert.alert(isNew ? "Check the password" : "Enter the password", error)
			return
		}
		if (await finishSyncedVault(state, patch)) pushAddVaultStep("done")
	}

	return (
		<>
			<Stack.Screen options={{ title: isNew ? `Protect ${target}` : `Unlock ${target}` }} />
			<NativeForm>
				<FormSection
					footer={
						isNew
							? "Notes are encrypted with this password. You need it on every device."
							: "Ask the owner if you don't have it."
					}
					title="Password"
				>
					<FormTextField
						autoCapitalize="none"
						autoFocus
						label="Password"
						onChangeText={(password) => patch({ password })}
						onSubmit={isNew ? undefined : () => void submit()}
						secure
					/>
					{isNew ? (
						<FormTextField
							autoCapitalize="none"
							label="Confirm password"
							onChangeText={(confirm) => patch({ confirm })}
							onSubmit={() => void submit()}
							secure
						/>
					) : null}
				</FormSection>
				<FormSection>
					<FormButton disabled={state.busy} label={label} onPress={() => void submit()} />
				</FormSection>
			</NativeForm>
		</>
	)
}
