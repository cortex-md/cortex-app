import { useVaultStore, type VaultListItem } from "@cortex/core"
import type { RemoteVaultInfo } from "@cortex/platform"
import { Stack } from "expo-router"
import { useMemo } from "react"
import { Alert, Platform } from "react-native"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import { dismissSheet, openSettings, presentSheet } from "@/features/navigation/routes"
import { FormCheckRow } from "@/features/onboarding/FormControls"
import { DEVICE_LABEL, useVaultListItems } from "@/features/vault/useVaultListItems"
import { useVaultSwitcher } from "@/features/vault/useVaultSwitcher"
import { accessLabel, useVaultAccess } from "@/features/vault/vaultAccess"

const IS_IOS = Platform.OS === "ios"

function SwitcherChrome() {
	if (IS_IOS) {
		return (
			<>
				<Stack.Screen options={{ title: "Vaults" }} />
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button icon="xmark" onPress={dismissSheet}>
						Close
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			</>
		)
	}
	return (
		<Stack.Screen
			options={{
				headerRight: () => (
					<HeaderIconButton
						accessibilityLabel="Close"
						icon={{ md: "close", sf: "xmark" }}
						onPress={dismissSheet}
					/>
				),
				title: "Vaults",
			}}
		/>
	)
}

function offerDownload(remote: RemoteVaultInfo): void {
	Alert.alert(`“${remote.name}” isn't on this ${DEVICE_LABEL} yet`, undefined, [
		{ style: "cancel", text: "Cancel" },
		{
			isPreferred: true,
			onPress: () => {
				dismissSheet()
				presentSheet("add-vault", { remoteVaultId: remote.id, start: "download" })
			},
			text: "Download",
		},
	])
}

function offerLocate(item: VaultListItem): void {
	Alert.alert(`“${item.entry.name}” was not found`, "Locate or remove it in Settings › Vaults.", [
		{ style: "cancel", text: "Cancel" },
		{
			onPress: () => {
				dismissSheet()
				openSettings("vaults")
			},
			text: "Open Settings",
		},
	])
}

export function VaultSwitcherSheet() {
	const currentUuid = useVaultStore((state) => state.vault?.uuid ?? null)
	const { items, loading, remoteOnly } = useVaultListItems()
	const { openVault, openingUuid, submitting } = useVaultSwitcher()
	const entries = useMemo(() => items.map((item) => item.entry), [items])
	const access = useVaultAccess(entries)

	async function handleOpen(item: VaultListItem) {
		if (item.status === "missing" || access.get(item.entry.uuid) === "missing") {
			offerLocate(item)
			return
		}
		if (item.entry.uuid === currentUuid) {
			dismissSheet()
			return
		}
		if (await openVault(item.entry)) dismissSheet()
	}

	return (
		<>
			<SwitcherChrome />
			<NativeForm>
				<FormSection title={`On this ${DEVICE_LABEL}`}>
					{loading && items.length === 0 ? <FormRow disabled title="Loading…" /> : null}
					{items.map((item) => {
						const opening = openingUuid === item.entry.uuid
						return (
							<FormCheckRow
								checked={item.entry.uuid === currentUuid}
								disabled={submitting && !opening}
								icon={{ md: "circle", sf: "circle.fill" }}
								iconColor={item.color}
								key={item.entry.uuid}
								onPress={() => void handleOpen(item)}
								subtitle={accessLabel(access.get(item.entry.uuid))}
								title={item.entry.name}
								value={opening ? "Opening…" : undefined}
							/>
						)
					})}
				</FormSection>
				{remoteOnly.length > 0 ? (
					<FormSection title="In your account">
						{remoteOnly.map((remote) => (
							<FormRow
								icon={{ md: "cloud_download", sf: "icloud.and.arrow.down" }}
								key={remote.id}
								onPress={() => offerDownload(remote)}
								title={remote.name}
							/>
						))}
					</FormSection>
				) : null}
				<FormSection>
					<FormRow
						icon={{ md: "add", sf: "plus" }}
						onPress={() => {
							dismissSheet()
							presentSheet("add-vault")
						}}
						tint
						title="Add vault"
					/>
					<FormRow
						chevron
						icon={{ md: "settings", sf: "gearshape" }}
						onPress={() => {
							dismissSheet()
							openSettings("vaults")
						}}
						title="Manage vaults"
					/>
				</FormSection>
			</NativeForm>
		</>
	)
}
