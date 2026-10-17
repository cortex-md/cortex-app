import { useMembersStore } from "@cortex/core"
import { roleInfo } from "@cortex/core/members"
import type { VaultInvite, VaultMember } from "@cortex/platform"
import {
	Badge,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Input,
	SimpleTooltip,
	Spinner,
	StatusBadge,
	toast,
} from "@cortex/ui"
import { FolderLockIcon, Mail, MoreHorizontalIcon, UserMinus, UserPlusIcon } from "lucide-react"
import { type FormEvent, useMemo, useState } from "react"
import { formatShortDate } from "@/utils/format"
import { useConfirmAction } from "../settings/ConfirmActionDialog"
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
	const { confirm, dialog } = useConfirmAction()

	const remove = (member: VaultMember) =>
		confirm({
			title: `Remove ${memberDisplayName(member)}?`,
			description: `${memberDisplayName(member)} loses access to this vault and its notes.`,
			confirmLabel: "Remove",
			destructive: true,
			onConfirm: async () => {
				clearError()
				await removeMember(vaultId, member.userId)
			},
		})

	return (
		<>
			{canManage && (
				<InviteRow
					vaultId={vaultId}
					roles={inviteRoles}
					onMoreOptions={() => setInviteOpen(true)}
				/>
			)}
			<SettingsSection title="Members" action={<Badge variant="secondary">{members.length}</Badge>}>
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
									onRemove={() => remove(member)}
								/>
							))}
						</SettingsList>
					)}
				</SettingsGroup>
			</SettingsSection>
			{dialog}
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
		<SettingsListItem data-has-icon="true">
			<UserAvatar name={name} avatarUrl={member.avatarUrl} className="settings-member-avatar" />
			<div className="settings-member-copy">
				<span className="settings-field-label">{name}</span>
				<span className="settings-field-description">
					{[
						member.email !== name ? member.email : null,
						`Joined ${formatShortDate(member.joinedAt)}`,
					]
						.filter(Boolean)
						.join(" · ")}
				</span>
			</div>
			<div className="settings-row-trail">
				{!member.hasKey && (
					<SimpleTooltip
						label={
							member.publicKey
								? "An admin device grants access automatically the next time it is online."
								: "This member has not set up encryption yet."
						}
					>
						<Badge variant="outline">Waiting for access</Badge>
					</SimpleTooltip>
				)}
				{editable ? (
					<RoleMenu
						label={`Role for ${name}`}
						value={member.role}
						roles={roles}
						onChange={onChangeRole}
					/>
				) : (
					<Badge variant="secondary">{roleInfo(member.role).label}</Badge>
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
	const { confirm, dialog } = useConfirmAction()
	if (pending.length === 0) return null

	const cancel = (invite: VaultInvite) =>
		confirm({
			title: "Cancel invite?",
			description: `The invite link for ${invite.inviteeEmail} will stop working.`,
			confirmLabel: "Cancel invite",
			destructive: true,
			onConfirm: async () => {
				clearError()
				await deleteInvite(vaultId, invite.id)
			},
		})

	return (
		<SettingsSection
			title="Pending"
			action={<StatusBadge dot={false}>{pending.length}</StatusBadge>}
		>
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
									variant="destructive-soft"
									size="xs"
									onClick={() => cancel(invite)}
									aria-label={`Cancel invite for ${invite.inviteeEmail}`}
								>
									Cancel
								</Button>
							</div>
						</SettingsListItem>
					))}
				</SettingsList>
			</SettingsGroup>
			{dialog}
		</SettingsSection>
	)
}

interface InviteRowProps {
	vaultId: string
	roles: readonly string[]
	onMoreOptions(): void
}

function InviteRow({ vaultId, roles, onMoreOptions }: InviteRowProps) {
	const createInvite = useMembersStore((state) => state.createInvite)
	const clearError = useMembersStore((state) => state.clearError)
	const inlineRoles = roles.filter((role) => role !== "guest")
	const [email, setEmail] = useState("")
	const [role, setRole] = useState(
		inlineRoles.includes("editor") ? "editor" : (inlineRoles[0] ?? "editor"),
	)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const trimmed = email.trim()
	const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)

	const submit = async (event: FormEvent) => {
		event.preventDefault()
		if (!valid || busy) return
		clearError()
		setBusy(true)
		setError(null)
		try {
			await createInvite(vaultId, trimmed, role, "")
			toast(`Invite sent to ${trimmed}`)
			setEmail("")
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause))
		} finally {
			setBusy(false)
		}
	}

	return (
		<SettingsSection
			fieldId="sync-members.invite"
			title="Invite"
			footer={error ?? "Editors can change notes. Viewers can read and search."}
			action={
				roles.includes("guest") ? (
					<Button variant="ghost" size="xs" onClick={onMoreOptions}>
						More options…
					</Button>
				) : undefined
			}
		>
			<SettingsGroup>
				<form className="members-invite-row" onSubmit={(event) => void submit(event)}>
					<Input
						type="email"
						value={email}
						placeholder="name@example.com"
						aria-label="Email to invite"
						onChange={(event) => setEmail(event.target.value)}
					/>
					<RoleMenu
						label="Role for the invite"
						value={role}
						roles={inlineRoles}
						onChange={setRole}
					/>
					<Button type="submit" disabled={!valid || busy}>
						{busy ? <Spinner className="size-3" /> : <UserPlusIcon />}
						Invite
					</Button>
				</form>
			</SettingsGroup>
		</SettingsSection>
	)
}
