import { MembersPanel } from "../../sync/MembersPanel"
import { SettingsPage } from "../SettingsPrimitives"
import { SignedOutNotice } from "./SignedOutNotice"
import { SyncDisabledNotice } from "./SyncDisabledNotice"
import { VaultLinkSection } from "./SyncOverview"

interface SyncMembersPageProps {
	authenticated: boolean
	linkedVaultId: string | null
	linkedVaultRole?: string
	syncEnabled: boolean
	onOpenLink(): void
}

export function SyncMembersPage({
	authenticated,
	linkedVaultId,
	linkedVaultRole,
	syncEnabled,
	onOpenLink,
}: SyncMembersPageProps) {
	if (!authenticated) {
		return (
			<SettingsPage>
				<SignedOutNotice />
			</SettingsPage>
		)
	}
	if (!syncEnabled) {
		return (
			<SettingsPage>
				<SyncDisabledNotice description="Enable sync in the Sync page before managing members." />
			</SettingsPage>
		)
	}
	if (!linkedVaultId) {
		return (
			<SettingsPage>
				<VaultLinkSection
					linkedVaultId={null}
					vaultName="Remote vault"
					devicesError={null}
					onOpenLink={onOpenLink}
				/>
			</SettingsPage>
		)
	}
	return (
		<SettingsPage>
			<MembersPanel vaultId={linkedVaultId} currentUserRole={linkedVaultRole} />
		</SettingsPage>
	)
}
