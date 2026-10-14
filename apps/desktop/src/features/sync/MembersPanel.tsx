import { useAccountStore, useMembersStore, useServerCapabilities, useSyncStore } from "@cortex/core"
import { TEAM_ROLES } from "@cortex/core/members"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cortex/ui"
import { useEffect, useState } from "react"
import { useSettingsRevealTarget } from "../settings/settingsReveal"
import { GroupsTab } from "./GroupsTab"
import { KeyTrustBanner } from "./KeyTrustBanner"
import { isVaultAdminRole } from "./memberDirectory"
import { PeopleTab } from "./PeopleTab"
import { VaultAccessSettings } from "./VaultAccessSettings"

type MembersTab = "people" | "groups" | "settings"

interface MembersPanelProps {
	vaultId: string
	currentUserRole?: string
}

export function MembersPanel({ vaultId, currentUserRole }: MembersPanelProps) {
	const members = useMembersStore((state) => state.members)
	const overviewVault = useMembersStore((state) => state.overviewVault)
	const error = useMembersStore((state) => state.error)
	const fetchOverview = useMembersStore((state) => state.fetchOverview)
	const ensureCapabilities = useAccountStore((state) => state.ensureCapabilities)
	const loadKeyTrustIssues = useSyncStore((state) => state.loadKeyTrustIssues)
	const capabilities = useServerCapabilities()
	const [tab, setTab] = useState<MembersTab>("people")
	const revealTarget = useSettingsRevealTarget()
	const [handledRevealNonce, setHandledRevealNonce] = useState<number | null>(null)
	if (revealTarget && revealTarget.nonce !== handledRevealNonce) {
		setHandledRevealNonce(revealTarget.nonce)
		if (revealTarget.fieldId?.startsWith("sync-members.")) setTab("people")
	}

	const canManage = isVaultAdminRole(currentUserRole)
	const guestsAvailable =
		capabilities?.features.guests !== false && overviewVault?.allowGuests !== false
	const inviteRoles = guestsAvailable ? [...TEAM_ROLES, "guest"] : TEAM_ROLES
	const memberRoles = currentUserRole === "owner" ? ["owner", ...inviteRoles] : inviteRoles
	const activeTab = tab === "settings" && !canManage ? "people" : tab

	// oxlint-disable react-doctor/no-event-handler -- members, invites and server features load for the selected vault
	useEffect(() => {
		if (currentUserRole) void fetchOverview(vaultId)
	}, [vaultId, fetchOverview, currentUserRole])

	useEffect(() => {
		void loadKeyTrustIssues(vaultId)
	}, [vaultId, loadKeyTrustIssues])

	useEffect(() => {
		void ensureCapabilities()
	}, [ensureCapabilities])
	// oxlint-enable react-doctor/no-event-handler

	return (
		<>
			<KeyTrustBanner vaultId={vaultId} canManage={canManage} members={members} />
			<Tabs
				value={activeTab}
				onValueChange={(value) => setTab(value as MembersTab)}
				className="members-tabs"
			>
				<TabsList className="members-tabs-list" aria-label="Members">
					<TabsTrigger value="people">People</TabsTrigger>
					<TabsTrigger value="groups">Groups</TabsTrigger>
					{canManage && <TabsTrigger value="settings">Settings</TabsTrigger>}
				</TabsList>
				<TabsContent value="people" className="members-tab-content">
					<PeopleTab
						vaultId={vaultId}
						canManage={canManage}
						inviteRoles={inviteRoles}
						memberRoles={memberRoles}
					/>
				</TabsContent>
				<TabsContent value="groups" className="members-tab-content">
					<GroupsTab vaultId={vaultId} canManage={canManage} />
				</TabsContent>
				{canManage && (
					<TabsContent value="settings" className="members-tab-content">
						{overviewVault ? (
							<VaultAccessSettings
								vault={overviewVault}
								onSaved={(vault) => useMembersStore.setState({ overviewVault: vault })}
							/>
						) : (
							<p className="share-muted">Loading vault settings…</p>
						)}
					</TabsContent>
				)}
			</Tabs>
			{error && <p className="settings-section-error">{error}</p>}
		</>
	)
}
