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
			Alert.alert("Enter the password", error)
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
							? "Your account password. Notes are end-to-end encrypted, and the key reaches your other devices on its own."
							: "Your account password, or the vault password if this vault still uses one."
					}
					title="Password"
				>
					<FormTextField
						autoCapitalize="none"
						autoFocus
						label="Password"
						onChangeText={(password) => patch({ password })}
						onSubmit={() => void submit()}
						secure
					/>
				</FormSection>
				<FormSection>
					<FormButton disabled={state.busy} label={label} onPress={() => void submit()} />
				</FormSection>
			</NativeForm>
		</>
	)
}
