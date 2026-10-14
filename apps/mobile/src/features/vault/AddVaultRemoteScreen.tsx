import {
	buildRemoteVaultOptions,
	describeRemoteVault,
	NEW_REMOTE,
	type RemoteVaultOption,
} from "@cortex/core"
import { Stack } from "expo-router"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { accountServerLabel, useAccountServer } from "@/features/account/accountServer"
import { useHostedSyncEntitlement } from "@/features/billing/billingAdapter"
import { openSettings } from "@/features/navigation/routes"
import { FormButton, FormCheckRow, FormTextField } from "@/features/onboarding/FormControls"
import { AddVaultCancelButton } from "@/features/vault/AddVaultCancelButton"
import { finishLocalVault } from "@/features/vault/addVaultActions"
import { useAddVault } from "@/features/vault/addVaultContext"
import { pushAddVaultStep, useCloseAddVault } from "@/features/vault/addVaultNavigation"
import { isNewRemote, localVaultName } from "@/features/vault/addVaultState"
import { DEVICE_LABEL, useVaultListItems } from "@/features/vault/useVaultListItems"
import { useRemoteVaultChoices } from "@/features/vault/vaultSyncAdapter"

function describeOption(option: RemoteVaultOption): string {
	if (option.takenBy) return `Already on this ${DEVICE_LABEL} as “${option.takenBy.entry.name}”`
	return describeRemoteVault(option.remote)
}

export function AddVaultRemoteScreen({ first = false }: { first?: boolean }) {
	const { patch, state } = useAddVault()
	const close = useCloseAddVault()
	const { locked: planLocked } = useHostedSyncEntitlement()
	const { items } = useVaultListItems()
	const server = useAccountServer()
	const choices = useRemoteVaultChoices()
	const isDownload = state.path === "download"
	const locked = planLocked && !server.selfHosted
	const serverName = accountServerLabel(server)
	const options = buildRemoteVaultOptions(choices, items, DEVICE_LABEL)
	const isNew = isNewRemote(state)
	const name = localVaultName(state)

	async function keepLocal() {
		if (await finishLocalVault(state, patch)) pushAddVaultStep("done")
	}

	return (
		<>
			<Stack.Screen options={{ title: isDownload ? "Get a vault" : "Remote vault" }} />
			{first ? <AddVaultCancelButton /> : null}
			<NativeForm>
				{locked ? (
					<FormSection footer={`Syncing with ${serverName} needs Hosted Sync.`}>
						<FormRow
							chevron
							icon={{ md: "workspace_premium", sf: "star" }}
							onPress={() => {
								close()
								openSettings("plan")
							}}
							title="See plans"
						/>
					</FormSection>
				) : null}
				<FormSection title={`Vaults on ${serverName}`}>
					{options.map((option) => (
						<FormCheckRow
							checked={state.remoteId === option.remote.id}
							disabled={locked || option.takenBy !== null}
							key={option.remote.id}
							onPress={() => patch({ remoteId: option.remote.id, remoteName: option.remote.name })}
							subtitle={describeOption(option)}
							title={option.remote.name}
						/>
					))}
					{isDownload ? null : (
						<FormCheckRow
							checked={isNew}
							disabled={locked}
							onPress={() =>
								patch({
									newRemoteName: state.newRemoteName || name,
									remoteId: NEW_REMOTE,
									remoteName: "",
								})
							}
							subtitle={`Upload this vault to ${serverName}`}
							title="Create a new remote vault"
						/>
					)}
				</FormSection>
				{isNew ? (
					<FormSection title="Remote name">
						<FormTextField
							autoCapitalize="words"
							defaultValue={state.newRemoteName}
							label="Remote name"
							onChangeText={(newRemoteName) => patch({ newRemoteName })}
						/>
					</FormSection>
				) : null}
				<FormSection>
					<FormButton
						disabled={locked || !state.remoteId || (isNew && !state.newRemoteName.trim())}
						label="Next"
						onPress={() => pushAddVaultStep("password")}
					/>
					{isDownload ? null : (
						<FormButton
							disabled={state.busy}
							label={`Keep on this ${DEVICE_LABEL} instead`}
							onPress={() => void keepLocal()}
							variant="plain"
						/>
					)}
				</FormSection>
			</NativeForm>
		</>
	)
}
