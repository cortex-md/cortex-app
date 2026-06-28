import { MembersPanel } from "../../sync/MembersPanel"
import {
	SettingsGroup,
	SettingsGroupContent,
	SettingsPage,
	SettingsSection,
} from "../SettingsPrimitives"
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
					remoteVaultRole={linkedVaultRole}
					engineState="idle"
					lastSyncedAt={null}
					connectedDeviceCount={0}
					devicesLoading={false}
					noteCount={0}
					onOpenLink={onOpenLink}
				/>
			</SettingsPage>
		)
	}
	return (
		<SettingsPage>
			<SettingsSection
				title="Members"
				description="Manage access and invitations for the linked remote vault."
			>
				<SettingsGroup>
					<SettingsGroupContent>
						<MembersPanel vaultId={linkedVaultId} currentUserRole={linkedVaultRole} />
					</SettingsGroupContent>
				</SettingsGroup>
			</SettingsSection>
		</SettingsPage>
	)
}
