import { useState } from "react"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"
import { pickVaultFolder } from "@/features/vault/addVaultActions"
import { AddVaultCancelButton } from "@/features/vault/AddVaultCancelButton"
import { useAddVault } from "@/features/vault/addVaultContext"
import { pushAddVaultStep, useCloseAddVault } from "@/features/vault/addVaultNavigation"
import { AddVaultRemoteScreen } from "@/features/vault/AddVaultRemoteScreen"
import { DEVICE_LABEL } from "@/features/vault/useVaultListItems"
import { useVaultSwitcher } from "@/features/vault/useVaultSwitcher"

export function AddVaultChooseScreen() {
	const { patch, state } = useAddVault()
	const close = useCloseAddVault()
	const { openVault } = useVaultSwitcher()
	const [startsWithDownload] = useState(state.path === "download")

	if (startsWithDownload) return <AddVaultRemoteScreen first />

	function create() {
		patch({ entry: null, folder: null, mode: null, name: "", path: "create", remoteId: null })
		pushAddVaultStep("name")
	}

	async function openFolder() {
		patch({ entry: null, mode: null, remoteId: null })
		const result = await pickVaultFolder(patch)
		if (result.kind === "picked") {
			pushAddVaultStep("name")
			return
		}
		if (result.kind !== "existing") return
		close()
		toast(`Opening ${result.entry.name}…`)
		await openVault(result.entry)
	}

	function download() {
		patch({ entry: null, mode: "sync", path: "download", remoteId: null })
		pushAddVaultStep("remote")
	}

	return (
		<>
			<AddVaultCancelButton />
			<NativeForm>
				<FormSection>
					<FormRow
						chevron
						icon={{ md: "create_new_folder", sf: "folder.badge.plus" }}
						onPress={create}
						subtitle="Start with an empty vault"
						title="Create new vault"
					/>
					<FormRow
						disabled={state.busy}
						icon={{ md: "folder_open", sf: "folder" }}
						onPress={() => void openFolder()}
						subtitle={`Use notes already on this ${DEVICE_LABEL}`}
						title="Open folder"
					/>
					<FormRow
						chevron
						icon={{ md: "cloud_download", sf: "icloud.and.arrow.down" }}
						onPress={download}
						subtitle="Download a vault you synced before"
						title="Get a vault from your account"
					/>
				</FormSection>
			</NativeForm>
		</>
	)
}
