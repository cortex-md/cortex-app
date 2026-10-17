import { linkVaultFolder, unlinkImpact, unlinkVaultFolder } from "@cortex/core"
import { toast } from "@cortex/ui"
import { type ReactNode, Suspense, useState } from "react"
import { useHasOpened } from "../../hooks/useHasOpened"
import { LazyVaultLinkModal } from "../sync/LazyVaultLinkModal"
import { DEVICE_LABEL } from "../vault/deviceLabel"
import { SelfHostedPage } from "./sync/SelfHostedPage"
import { SyncMembersPage } from "./sync/SyncMembers"
import { SyncOverviewPage } from "./sync/SyncOverview"
import { SyncPreferencesPage } from "./sync/SyncPreferences"
import type { SyncSettingsView } from "./sync/types"
import { useSyncOverview } from "./sync/useSyncOverview"
import { type VaultImpact, VaultImpactDialog } from "./vaults/VaultImpactDialog"

export type { SyncSettingsView } from "./sync/types"

interface SyncSectionProps {
	view?: SyncSettingsView
}

export function SyncSection({ view = "overview" }: SyncSectionProps) {
	const overview = useSyncOverview(view)
	const [linkModalOpen, setLinkModalOpen] = useState(false)
	const linkModalMounted = useHasOpened(linkModalOpen)
	const openLink = () => setLinkModalOpen(true)
	const [stopImpact, setStopImpact] = useState<VaultImpact | null>(null)
	const vaultPath = overview.vault?.path
	const localName = overview.vault?.name ?? "this vault"
	const remoteName = overview.linkedVault?.name ?? localName

	const stopSyncing = async () => {
		const remoteVaultId = overview.linkedVaultId
		if (!vaultPath) return
		try {
			await unlinkVaultFolder(vaultPath)
			toast(`${localName} is now only on this Mac`, {
				action: remoteVaultId
					? { label: "Undo", onClick: () => void linkVaultFolder(vaultPath, remoteVaultId) }
					: undefined,
			})
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error))
		}
	}

	let content: ReactNode
	switch (view) {
		case "overview":
			content = (
				<SyncOverviewPage
					authenticated={overview.authenticated}
					connectedDeviceCount={overview.connectedDeviceCount}
					devicesError={overview.devicesError}
					devicesLoading={overview.devicesLoading}
					engineState={overview.engineState}
					lastSyncedAt={overview.lastSyncedAt}
					linkedVaultId={overview.linkedVaultId}
					noteCount={overview.noteCount}
					remoteVaultRole={overview.linkedVault?.role}
					serverLabel={overview.serverLabel}
					vaultName={overview.linkedVault?.name ?? overview.vault?.name ?? "Remote vault"}
					vaultPath={overview.vault?.path}
					syncEnabled={overview.syncConfig.enabled}
					localVaultName={overview.vault?.name}
					onOpenLink={openLink}
					onStopSyncing={() =>
						setStopImpact(unlinkImpact(localName, remoteName, overview.serverLabel, DEVICE_LABEL))
					}
				/>
			)
			break
		case "preferences":
			content = (
				<SyncPreferencesPage
					authenticated={overview.authenticated}
					syncEnabled={overview.syncConfig.enabled}
				/>
			)
			break
		case "members":
			content = (
				<SyncMembersPage
					authenticated={overview.authenticated}
					linkedVaultId={overview.linkedVaultId}
					linkedVaultRole={overview.linkedVault?.role}
					syncEnabled={overview.syncConfig.enabled}
					onOpenLink={openLink}
				/>
			)
			break
		case "self-host":
			content = <SelfHostedPage enabled={overview.syncConfig.selfHosted} />
			break
	}

	return (
		<>
			{content}
			<VaultImpactDialog
				impact={stopImpact}
				onOpenChange={(open) => {
					if (!open) setStopImpact(null)
				}}
				onConfirm={stopSyncing}
			/>
			{linkModalMounted && (
				<Suspense fallback={null}>
					<LazyVaultLinkModal open={linkModalOpen} onOpenChange={setLinkModalOpen} />
				</Suspense>
			)}
		</>
	)
}
