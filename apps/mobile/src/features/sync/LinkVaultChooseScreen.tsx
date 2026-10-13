import { useRemoteVaultStore, useVaultStore } from "@cortex/core"
import { router, Stack } from "expo-router"
import { useState } from "react"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"
import { openSettings } from "@/features/navigation/routes"
import { FormCheck, FormTextField } from "@/features/sync/FormControls"
import { getRemoteVaultLinkOptions, linkRemoteVault } from "@/features/sync/syncAdapter"

const MIN_PASSWORD_LENGTH = 8

export function LinkVaultChooseScreen() {
	const vault = useVaultStore((state) => state.vault)
	const remoteVaults = useRemoteVaultStore((state) => state.remoteVaults)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const options = getRemoteVaultLinkOptions(remoteVaults, linkedVaultId)
	const [pickId, setPickId] = useState(
		() => options.find((option) => !option.taken && !option.isNew)?.id ?? options[0]?.id ?? "",
	)
	const [newName, setNewName] = useState("")
	const [password, setPassword] = useState("")
	const [confirm, setConfirm] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [linking, setLinking] = useState(false)

	const picked = options.find((option) => option.id === pickId)
	const creating = Boolean(picked && (picked.isNew || !picked.encrypted))
	const targetName = picked?.isNew ? newName.trim() || "Notes" : (picked?.name ?? "")
	const vaultPath = vault?.path ?? null

	const submit = () => {
		if (!picked || !vaultPath || linking) return
		if (creating && password.length < MIN_PASSWORD_LENGTH) {
			setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
			return
		}
		if (creating && password !== confirm) {
			setError("The passwords do not match.")
			return
		}
		if (!creating && !password) {
			setError("Enter the password.")
			return
		}
		setLinking(true)
		void linkRemoteVault(vaultPath, picked, newName)
			.then(() => {
				toast(`Linked to ${targetName}. The first sync is running.`)
				if (router.canGoBack()) router.back()
			})
			.catch((reason: unknown) => {
				setLinking(false)
				setError(reason instanceof Error ? reason.message : String(reason))
			})
	}

	const passwordFooter =
		error ??
		(creating
			? "Encrypts this vault. You need it on every device."
			: `The password set when ${targetName} was created.`)

	return (
		<>
			<Stack.Screen options={{ headerLargeTitleEnabled: false, title: "Link vault" }} />
			<NativeForm>
				<FormSection title="Cortex Cloud">
					{options.map((option) => (
						<FormRow
							disabled={option.taken}
							icon={
								option.isNew
									? { sf: "plus.circle", md: "add_circle" }
									: { sf: "icloud", md: "cloud" }
							}
							key={option.id}
							onPress={() => {
								setPickId(option.id)
								setPassword("")
								setConfirm("")
								setError(null)
							}}
							subtitle={option.description}
							title={option.name}
							trailing={<FormCheck checked={option.id === pickId} />}
						/>
					))}
				</FormSection>
				<FormSection>
					<FormRow
						chevron
						icon={{ sf: "server.rack", md: "dns" }}
						onPress={() => openSettings("sync/self-hosted")}
						title="Use a self-hosted server"
					/>
				</FormSection>
				{picked?.isNew ? (
					<FormSection title="Name">
						<FormTextField initialValue={newName} onChangeText={setNewName} placeholder="Notes" />
					</FormSection>
				) : null}
				<FormSection footer={passwordFooter} title="Encryption password">
					<FormTextField
						key={`password-${pickId}`}
						onChangeText={(value) => {
							setPassword(value)
							setError(null)
						}}
						placeholder="Password"
						secure
					/>
					{creating ? (
						<FormTextField
							key={`confirm-${pickId}`}
							onChangeText={(value) => {
								setConfirm(value)
								setError(null)
							}}
							onSubmit={submit}
							placeholder="Confirm password"
							secure
						/>
					) : null}
				</FormSection>
				<FormSection>
					<FormRow
						disabled={!picked || linking}
						onPress={submit}
						tint
						title={creating ? "Create and link" : "Unlock and link"}
					/>
				</FormSection>
			</NativeForm>
		</>
	)
}
