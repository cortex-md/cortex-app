import type { VaultRegistryEntry } from "@cortex/platform"
import { Button as ExpoButton } from "@expo/ui"

import { ActionSheet } from "@/components/ui/ActionSheet"

export function WorkspaceSwitcherSheet({
	activeVaultUuid,
	isPresented,
	onBrowseVault,
	onDismiss,
	onOpenRecentVault,
	recentVaults,
	submitting,
}: {
	activeVaultUuid: string | null
	isPresented: boolean
	onBrowseVault: () => void
	onDismiss: () => void
	onOpenRecentVault: (entry: VaultRegistryEntry) => void
	recentVaults: VaultRegistryEntry[]
	submitting: boolean
}) {
	return (
		<ActionSheet
			isPresented={isPresented}
			onDismiss={onDismiss}
			sectionTitle="Vaults"
			supportingText="Open a recent vault or browse for another folder."
			title="Switch vault"
		>
			<ExpoButton disabled={submitting} label="Browse folder" onPress={onBrowseVault} />
			{recentVaults.map((entry) => (
				<ExpoButton
					disabled={submitting || entry.uuid === activeVaultUuid}
					key={entry.uuid}
					label={`${entry.uuid === activeVaultUuid ? "Current: " : ""}${entry.name}`}
					onPress={() => onOpenRecentVault(entry)}
					variant="outlined"
				/>
			))}
		</ActionSheet>
	)
}
