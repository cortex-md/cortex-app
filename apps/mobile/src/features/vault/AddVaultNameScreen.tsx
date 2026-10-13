import { Stack } from "expo-router"

import { FormSection, NativeForm } from "@/components/ui/Form"
import { FormButton, FormPicker, FormTextField } from "@/features/onboarding/FormControls"
import { vaultColorOptions } from "@/features/onboarding/vaultAppearance"
import { useAddVault } from "@/features/vault/addVaultContext"
import { pushAddVaultStep } from "@/features/vault/addVaultNavigation"

export function AddVaultNameScreen() {
	const { patch, state } = useAddVault()
	const canContinue = state.name.trim().length > 0
	const next = () => pushAddVaultStep("sync")

	return (
		<>
			<Stack.Screen options={{ title: state.path === "open" ? "Open folder" : "New vault" }} />
			<NativeForm>
				<FormSection title="Name">
					<FormTextField
						autoCapitalize="words"
						autoFocus={state.path !== "open"}
						defaultValue={state.name}
						key={state.folder?.path ?? "new"}
						label="Vault name"
						onChangeText={(name) => patch({ name })}
						onSubmit={canContinue ? next : undefined}
						placeholder="Vault name"
					/>
				</FormSection>
				<FormSection title="Appearance">
					<FormPicker
						icon={{ md: "palette", sf: "paintpalette" }}
						label="Color"
						onChange={(color) => patch({ color })}
						options={vaultColorOptions}
						value={state.color}
					/>
				</FormSection>
				<FormSection>
					<FormButton disabled={!canContinue} label="Next" onPress={next} />
				</FormSection>
			</NativeForm>
		</>
	)
}
