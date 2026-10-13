import { Stack } from "expo-router"

import { FormSection, NativeForm } from "@/components/ui/Form"
import { useHostedSyncEntitlement } from "@/features/billing/billingAdapter"
import { FormButton, FormCheckRow } from "@/features/onboarding/FormControls"
import { finishLocalVault } from "@/features/vault/addVaultActions"
import { useAddVault } from "@/features/vault/addVaultContext"
import { pushAddVaultStep } from "@/features/vault/addVaultNavigation"
import { localVaultName } from "@/features/vault/addVaultState"
import { DEVICE_LABEL } from "@/features/vault/useVaultListItems"

export function AddVaultSyncScreen() {
	const { patch, state } = useAddVault()
	const { locked } = useHostedSyncEntitlement()
	const name = localVaultName(state)

	async function finish() {
		if (await finishLocalVault(state, patch)) pushAddVaultStep("done")
	}

	return (
		<>
			<Stack.Screen options={{ title: `Sync ${name}` }} />
			<NativeForm>
				<FormSection footer="You can turn sync on or off later.">
					<FormCheckRow
						checked={state.mode === "keep"}
						onPress={() => patch({ mode: "keep" })}
						subtitle="Plain Markdown files"
						title={`Keep it on this ${DEVICE_LABEL}`}
					/>
					<FormCheckRow
						checked={state.mode === "sync"}
						onPress={() => patch({ mode: "sync" })}
						subtitle={
							locked ? "Needs a plan or your own server" : "Link it to a vault in your account"
						}
						title="Sync it"
					/>
				</FormSection>
				<FormSection>
					{state.mode === "sync" ? (
						<FormButton label="Next" onPress={() => pushAddVaultStep("remote")} />
					) : (
						<FormButton
							disabled={state.mode === null || state.busy}
							label={state.path === "open" ? "Open as vault" : "Create vault"}
							onPress={() => void finish()}
						/>
					)}
				</FormSection>
			</NativeForm>
		</>
	)
}
