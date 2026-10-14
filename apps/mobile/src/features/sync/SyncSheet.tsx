import {
	formatLastSyncedAt,
	getSyncServerLabel,
	useEditorStore,
	useRemoteVaultStore,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import { getBaseName } from "@cortex/platform/utils"
import { Stack } from "expo-router"
import { useEffect } from "react"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"
import {
	dismissSheet,
	openConflict,
	openSettings,
	openVersionHistory,
} from "@/features/navigation/routes"
import { syncNow } from "@/features/sync/syncAdapter"
import { reloadSyncConflicts } from "@/features/sync/syncConflicts"
import { useSyncConflicts, useSyncStatusPresentation } from "@/features/sync/syncStatus"

function after(action: () => void): () => void {
	return () => {
		dismissSheet()
		action()
	}
}

export function SyncSheet() {
	const presentation = useSyncStatusPresentation()
	const conflicts = useSyncConflicts()
	const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const activeFilePath = useEditorStore((state) => state.activeFilePath)

	useEffect(() => {
		void reloadSyncConflicts()
	}, [])

	if (!linkedVaultId) {
		return (
			<>
				<Stack.Screen options={{ title: "Sync" }} />
				<NativeForm>
					<FormSection footer="Link this vault to a vault in your account to sync it with your other devices.">
						<FormRow
							icon={{ md: "cloud_off", sf: "icloud.slash" }}
							title="This vault isn't synced"
						/>
						<FormRow onPress={after(() => openSettings("sync/link"))} tint title="Set up sync" />
					</FormSection>
				</NativeForm>
			</>
		)
	}

	return (
		<>
			<Stack.Screen options={{ title: "Sync" }} />
			<NativeForm>
				<FormSection>
					<FormRow
						icon={presentation.icon}
						subtitle={`Synced ${formatLastSyncedAt(lastSyncedAt).toLowerCase()} · ${getSyncServerLabel(syncConfig)}`}
						title={presentation.label}
					/>
					<FormRow
						disabled={presentation.busy || !syncConfig.enabled}
						icon={{ md: "sync", sf: "arrow.triangle.2.circlepath" }}
						onPress={() => {
							void syncNow().catch(() => toast("Could not start sync"))
						}}
						tint
						title="Sync now"
					/>
				</FormSection>
				{conflicts.length > 0 ? (
					<FormSection
						footer="These notes changed here and on another device. Choose which version to keep."
						title={`Conflicts (${conflicts.length})`}
					>
						{conflicts.map((conflict) => (
							<FormRow
								chevron
								icon={{ md: "warning", sf: "exclamationmark.triangle.fill" }}
								key={conflict.relativePath}
								onPress={after(() => openConflict(conflict.filePath))}
								subtitle={conflict.relativePath}
								title={conflict.name}
							/>
						))}
					</FormSection>
				) : null}
				<FormSection title="History">
					{activeFilePath && vaultPath && activeFilePath.startsWith(vaultPath) ? (
						<FormRow
							chevron
							icon={{ md: "history", sf: "clock.arrow.circlepath" }}
							onPress={after(() => openVersionHistory(activeFilePath))}
							subtitle={getBaseName(activeFilePath).replace(/\.md$/iu, "")}
							title="Version history"
						/>
					) : null}
					<FormRow
						chevron
						icon={{ md: "receipt_long", sf: "list.bullet.rectangle" }}
						onPress={after(() => openSettings("sync-logs"))}
						title="Sync logs"
					/>
					<FormRow
						chevron
						icon={{ md: "delete", sf: "trash" }}
						onPress={after(() => openSettings("deleted-notes"))}
						title="Deleted notes"
					/>
				</FormSection>
				<FormSection>
					<FormRow
						chevron
						icon={{ md: "settings", sf: "gearshape" }}
						onPress={after(() => openSettings("sync"))}
						title="Sync settings"
					/>
				</FormSection>
			</NativeForm>
		</>
	)
}
