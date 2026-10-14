import { Stack } from "expo-router"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { accountServerLabel, useAccountServer } from "@/features/account/accountServer"
import { toast } from "@/features/feedback/useToast"
import { FormButton } from "@/features/onboarding/FormControls"
import { useAddVault } from "@/features/vault/addVaultContext"
import { useCloseAddVault } from "@/features/vault/addVaultNavigation"
import { localVaultName } from "@/features/vault/addVaultState"
import { DEVICE_LABEL } from "@/features/vault/useVaultListItems"
import { useVaultSwitcher } from "@/features/vault/useVaultSwitcher"
import { useDownloadProgress } from "@/features/vault/vaultSyncAdapter"

export function AddVaultDoneScreen() {
	const { state } = useAddVault()
	const close = useCloseAddVault()
	const { openVault } = useVaultSwitcher()
	const isDownload = state.path === "download"
	const progress = useDownloadProgress(isDownload)
	const name = state.entry?.name ?? (localVaultName(state) || state.remoteName)
	const synced = state.mode !== "keep"
	const serverName = accountServerLabel(useAccountServer())

	async function open() {
		const entry = state.entry
		close()
		if (!entry) return
		toast(`Opening ${entry.name}…`)
		await openVault(entry)
	}

	return (
		<>
			<Stack.Screen options={{ title: isDownload ? "Downloading" : "Ready" }} />
			<NativeForm>
				<FormSection title={name}>
					<FormRow
						title="Sync"
						value={
							synced ? `With ${state.remoteName || serverName}` : `Only on this ${DEVICE_LABEL}`
						}
					/>
					<FormRow title="Encryption" value={synced ? "On" : "Off"} />
					{isDownload ? (
						<FormRow title="Downloaded" value={`${Math.round(progress * 100)}%`} />
					) : null}
				</FormSection>
				<FormSection>
					<FormButton label={`Open ${name}`} onPress={() => void open()} />
					<FormButton label="Close" onPress={close} variant="plain" />
				</FormSection>
			</NativeForm>
		</>
	)
}
