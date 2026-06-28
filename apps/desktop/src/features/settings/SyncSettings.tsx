import { type ReactNode, useState } from "react"
import { VaultLinkModal } from "../sync/VaultLinkModal"
import { SelfHostedPage } from "./sync/SelfHostedPage"
import { SyncMembersPage } from "./sync/SyncMembers"
import { SyncOverviewPage } from "./sync/SyncOverview"
import { SyncPreferencesPage } from "./sync/SyncPreferences"
import type { SyncSettingsView } from "./sync/types"
import { useSyncOverview } from "./sync/useSyncOverview"

export type { SyncSettingsView } from "./sync/types"

interface SyncSectionProps {
	view?: SyncSettingsView
}

export function SyncSection({ view = "overview" }: SyncSectionProps) {
	const overview = useSyncOverview(view)
	const [linkModalOpen, setLinkModalOpen] = useState(false)
	const openLink = () => setLinkModalOpen(true)

	let content: ReactNode
	switch (view) {
		case "overview":
			content = (
				<SyncOverviewPage
					authenticated={overview.authenticated}
					connectedDeviceCount={overview.connectedDeviceCount}
					devicesLoading={overview.devicesLoading}
					engineState={overview.engineState}
					lastSyncedAt={overview.lastSyncedAt}
					linkedVaultId={overview.linkedVaultId}
					noteCount={overview.noteCount}
					remoteVaultRole={overview.linkedVault?.role}
					vaultName={overview.linkedVault?.name ?? overview.vault?.name ?? "Remote vault"}
					vaultPath={overview.vault?.path}
					syncEnabled={overview.syncConfig.enabled}
					onOpenLink={openLink}
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
			<VaultLinkModal open={linkModalOpen} onOpenChange={setLinkModalOpen} />
		</>
	)
}
