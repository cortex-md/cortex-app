import { useMembersStore } from "@cortex/core"
import type { VaultInvite, VaultMember } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Spinner,
} from "@cortex/ui"
import {
	FolderLockIcon,
	Mail,
	MoreHorizontalIcon,
	UserMinus,
	UserPlusIcon,
	XIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { formatCount, formatShortDate } from "@/utils/format"
import {
	SettingsEmptyState,
	SettingsGroup,
	SettingsIconTile,
	SettingsList,
	SettingsListItem,
	SettingsSection,
} from "../settings/SettingsPrimitives"
import { GuestAccessDialog } from "./GuestAccessDialog"
import { InviteDialog } from "./InviteDialog"
import { memberDisplayName } from "./memberDirectory"
import { roleInfo } from "./memberRoles"
import { RoleMenu } from "./RoleMenu"
import { UserAvatar } from "./UserAvatar"

interface PeopleTabProps {
	vaultId: string
	canManage: boolean
	inviteRoles: readonly string[]
	memberRoles: readonly string[]
}

export function PeopleTab({ vaultId, canManage, inviteRoles, memberRoles }: PeopleTabProps) {
	const members = useMembersStore((state) => state.members)
	const loading = useMembersStore((state) => state.loading)
	const updateMemberRole = useMembersStore((state) => state.updateMemberRole)
	const removeMember = useMembersStore((state) => state.removeMember)
	const clearError = useMembersStore((state) => state.clearError)
	const [inviteOpen, setInviteOpen] = useState(false)
	const [accessMember, setAccessMember] = useState<VaultMember | null>(null)

	const remove = async (member: VaultMember) => {
		const confirmed = await getPlatform().dialog.showConfirm({
			title: "Remove from vault",
			message: `${memberDisplayName(member)} loses access to this vault and its notes.`,
			destructive: true,
			confirmLabel: "Remove",
		})
		if (!confirmed) return
		clearError()
		await removeMember(vaultId, member.userId)
	}

	return (
		<>
			<div className="members-tab-header" data-settings-field="sync-members.invite">
				<span className="members-tab-count">{formatCount(members.length, "person", "people")}</span>
				{canManage && (
					<Button size="sm" onClick={() => setInviteOpen(true)}>
						<UserPlusIcon />
						Invite people
					</Button>
				)}
			</div>
			<SettingsGroup data-settings-field="sync-members.members">
				{loading && members.length === 0 ? (
					<SettingsEmptyState className="settings-loading-state">
						<Spinner className="size-4" />
						Loading members
					</SettingsEmptyState>
				) : members.length === 0 ? (
					<SettingsEmptyState>
						No members yet. Invite someone to start working together.
					</SettingsEmptyState>
				) : (
					<SettingsList>
						{members.map((member) => (
							<MemberRow
								key={member.userId}
								member={member}
								canManage={canManage}
								roles={memberRoles}
								onChangeRole={(role) => {
									clearError()
									void updateMemberRole(vaultId, member.userId, role)
								}}
								onChangeAccess={() => setAccessMember(member)}
								onRemove={() => void remove(member)}
							/>
						))}
					</SettingsList>
				)}
			</SettingsGroup>
			{canManage && <InvitedList vaultId={vaultId} />}
			{canManage && (
				<>
					<InviteDialog
						vaultId={vaultId}
						roles={inviteRoles}
						open={inviteOpen}
						onOpenChange={setInviteOpen}
					/>
					<GuestAccessDialog
						vaultId={vaultId}
						member={accessMember}
						onClose={() => setAccessMember(null)}
					/>
				</>
			)}
		</>
	)
}

interface MemberRowProps {
	member: VaultMember
	canManage: boolean
	roles: readonly string[]
	onChangeRole(role: string): void
	onChangeAccess(): void
	onRemove(): void
}

function MemberRow({
	member,
	canManage,
	roles,
	onChangeRole,
	onChangeAccess,
	onRemove,
}: MemberRowProps) {
	const name = memberDisplayName(member)
	const editable = canManage && member.role !== "owner"
	return (
		<SettingsListItem data-has-icon="true" title={`Joined ${formatShortDate(member.joinedAt)}`}>
			<UserAvatar name={name} avatarUrl={member.avatarUrl} className="settings-member-avatar" />
			<div className="settings-member-copy">
				<span className="settings-field-label">{name}</span>
				{member.email !== name && (
					<span className="settings-field-description">{member.email}</span>
				)}
			</div>
			<div className="settings-row-trail">
				{!member.hasKey && (
					<span
						className="settings-pill"
						title={
							member.publicKey
								? "An admin device grants access automatically the next time it is online."
								: "This member has not set up encryption yet."
						}
					>
						Waiting for access
					</span>
				)}
				{editable ? (
					<RoleMenu
						label={`Role for ${name}`}
						value={member.role}
						roles={roles}
						onChange={onChangeRole}
					/>
				) : (
					<span className="settings-row-kind">{roleInfo(member.role).label}</span>
				)}
				{editable && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon-xs"
								aria-label={`More actions for ${name}`}
								className="settings-row-remove"
							>
								<MoreHorizontalIcon />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{member.role === "guest" && (
								<>
									<DropdownMenuItem onSelect={onChangeAccess}>
										<FolderLockIcon />
										Change access…
									</DropdownMenuItem>
									<DropdownMenuSeparator />
								</>
							)}
							<DropdownMenuItem variant="destructive" onSelect={onRemove}>
								<UserMinus />
								Remove from vault
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>
		</SettingsListItem>
	)
}

function InvitedList({ vaultId }: { vaultId: string }) {
	const invites = useMembersStore((state) => state.invites)
	const deleteInvite = useMembersStore((state) => state.deleteInvite)
	const clearError = useMembersStore((state) => state.clearError)
	const pending = useMemo(() => invites.filter((invite) => !invite.accepted), [invites])
	if (pending.length === 0) return null

	const cancel = async (invite: VaultInvite) => {
		const confirmed = await getPlatform().dialog.showConfirm({
			title: "Cancel invite",
			message: `The invite link for ${invite.inviteeEmail} will stop working.`,
			destructive: true,
			confirmLabel: "Cancel invite",
		})
		if (!confirmed) return
		clearError()
		await deleteInvite(vaultId, invite.id)
	}

	return (
		<SettingsSection title="Invited">
			<SettingsGroup>
				<SettingsList>
					{pending.map((invite) => (
						<SettingsListItem key={invite.id} data-has-icon="true">
							<SettingsIconTile>
								<Mail />
							</SettingsIconTile>
							<div className="settings-member-copy">
								<span className="settings-field-label">{invite.inviteeEmail}</span>
								<span className="settings-field-description">
									{roleInfo(invite.role).label} · Expires {formatShortDate(invite.expiresAt)}
								</span>
							</div>
							<div className="settings-row-trail">
								<Button
									variant="ghost"
									size="icon-xs"
									onClick={() => void cancel(invite)}
									aria-label={`Cancel invite for ${invite.inviteeEmail}`}
									className="settings-row-remove"
								>
									<XIcon />
								</Button>
							</div>
						</SettingsListItem>
					))}
				</SettingsList>
			</SettingsGroup>
		</SettingsSection>
	)
}
