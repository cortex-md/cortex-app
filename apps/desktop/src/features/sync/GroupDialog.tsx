import { useMembersStore } from "@cortex/core"
import type { VaultGroup, VaultMember } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
	Button,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Spinner,
} from "@cortex/ui"
import { Trash2, XIcon } from "lucide-react"
import { type FormEvent, useMemo, useState } from "react"
import { formatCount } from "@/utils/format"
import { ModalHost } from "@/utils/ModalHost"
import {
	SettingsEmptyState,
	SettingsGroup,
	SettingsList,
	SettingsListItem,
} from "../settings/SettingsPrimitives"
import { memberDisplayName, messageOf, useMemberDirectory } from "./memberDirectory"
import { PrincipalPicker } from "./PrincipalPicker"
import { UserAvatar } from "./UserAvatar"

const MAX_GROUP_NAME_LENGTH = 64

export type GroupDialogTarget = { kind: "create" } | { kind: "edit"; groupId: string }

interface GroupDialogProps {
	vaultId: string
	canManage: boolean
	target: GroupDialogTarget | null
	onClose(): void
}

export function GroupDialog({ vaultId, canManage, target, onClose }: GroupDialogProps) {
	return (
		<ModalHost open={target !== null} onOpenChange={(open) => !open && onClose()}>
			{target && (
				<DialogContent className="max-h-[min(640px,calc(100vh-2rem))] overflow-y-auto sm:max-w-[480px]">
					{target.kind === "create" ? (
						<CreateGroupForm vaultId={vaultId} onDone={onClose} />
					) : (
						<EditGroup
							vaultId={vaultId}
							groupId={target.groupId}
							canManage={canManage}
							onDeleted={onClose}
						/>
					)}
				</DialogContent>
			)}
		</ModalHost>
	)
}

function useMembersOf(memberIds: readonly string[]): VaultMember[] {
	const directory = useMemberDirectory()
	return useMemo(
		() =>
			memberIds.flatMap((memberId) => {
				const member = directory.get(memberId)
				return member ? [member] : []
			}),
		[directory, memberIds],
	)
}

interface GroupMemberListProps {
	groupName: string
	members: readonly VaultMember[]
	canManage: boolean
	busy: boolean
	onRemove(userId: string): void
}

function GroupMemberList({ groupName, members, canManage, busy, onRemove }: GroupMemberListProps) {
	return (
		<SettingsGroup>
			{members.length === 0 ? (
				<SettingsEmptyState>No one is in this group yet.</SettingsEmptyState>
			) : (
				<SettingsList>
					{members.map((member) => {
						const name = memberDisplayName(member)
						return (
							<SettingsListItem key={member.userId} data-has-icon="true">
								<UserAvatar
									name={name}
									avatarUrl={member.avatarUrl}
									className="settings-member-avatar"
								/>
								<div className="settings-member-copy">
									<span className="settings-field-label">{name}</span>
									{member.email !== name && (
										<span className="settings-field-description">{member.email}</span>
									)}
								</div>
								{canManage && (
									<div className="settings-row-trail">
										<Button
											variant="ghost"
											size="icon-xs"
											disabled={busy}
											aria-label={`Remove ${name} from ${groupName || "group"}`}
											className="settings-row-remove"
											onClick={() => onRemove(member.userId)}
										>
											<XIcon />
										</Button>
									</div>
								)}
							</SettingsListItem>
						)
					})}
				</SettingsList>
			)}
		</SettingsGroup>
	)
}

function CreateGroupForm({ vaultId, onDone }: { vaultId: string; onDone(): void }) {
	const createGroup = useMembersStore((state) => state.createGroup)
	const allMembers = useMembersStore((state) => state.members)
	const [name, setName] = useState("")
	const [memberIds, setMemberIds] = useState<string[]>([])
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const selected = useMembersOf(memberIds)
	const selectedIds = useMemo(() => new Set(memberIds), [memberIds])

	const submit = async (event: FormEvent) => {
		event.preventDefault()
		const trimmed = name.trim()
		if (!trimmed) return
		setBusy(true)
		setError(null)
		let created = false
		try {
			await createGroup(vaultId, trimmed, memberIds)
			created = true
		} catch (cause) {
			setError(messageOf(cause))
		} finally {
			setBusy(false)
		}
		if (created) onDone()
	}

	return (
		<form className="contents" onSubmit={(event) => void submit(event)}>
			<DialogHeader>
				<DialogTitle>New group</DialogTitle>
				<DialogDescription>Give access to everyone in the group at once.</DialogDescription>
			</DialogHeader>
			<div className="form-dialog-fields">
				<div className="form-dialog-field">
					<label htmlFor="group-name" className="form-dialog-label">
						Name
					</label>
					<Input
						id="group-name"
						autoFocus
						placeholder="e.g. Design"
						maxLength={MAX_GROUP_NAME_LENGTH}
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</div>
				<div className="form-dialog-field">
					<div className="flex items-center justify-between gap-2">
						<p className="form-dialog-label">Members</p>
						<PrincipalPicker
							members={allMembers}
							excludedUserIds={selectedIds}
							label="Add people"
							placeholder="Search members"
							disabled={busy}
							onSelect={(selection) => setMemberIds((ids) => [...ids, selection.principalId])}
						/>
					</div>
					<GroupMemberList
						groupName={name.trim()}
						members={selected}
						canManage
						busy={busy}
						onRemove={(userId) => setMemberIds((ids) => ids.filter((id) => id !== userId))}
					/>
				</div>
				{error && <p className="settings-section-error">{error}</p>}
			</div>
			<DialogFooter>
				<Button type="submit" disabled={busy || !name.trim()}>
					{busy && <Spinner className="size-3" />}
					Create group
				</Button>
			</DialogFooter>
		</form>
	)
}

interface EditGroupProps {
	vaultId: string
	groupId: string
	canManage: boolean
	onDeleted(): void
}

function EditGroup({ vaultId, groupId, canManage, onDeleted }: EditGroupProps) {
	const group = useMembersStore((state) => state.groups.find((item) => item.id === groupId))
	if (!group) {
		return (
			<DialogHeader>
				<DialogTitle>Group not found</DialogTitle>
				<DialogDescription>This group was deleted.</DialogDescription>
			</DialogHeader>
		)
	}
	return (
		<EditGroupContent vaultId={vaultId} group={group} canManage={canManage} onDeleted={onDeleted} />
	)
}

interface EditGroupContentProps {
	vaultId: string
	group: VaultGroup
	canManage: boolean
	onDeleted(): void
}

function EditGroupContent({ vaultId, group, canManage, onDeleted }: EditGroupContentProps) {
	const updateGroup = useMembersStore((state) => state.updateGroup)
	const deleteGroup = useMembersStore((state) => state.deleteGroup)
	const allMembers = useMembersStore((state) => state.members)
	const groupMembers = useMembersOf(group.memberIds)
	const memberIds = useMemo(() => new Set(group.memberIds), [group.memberIds])
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const run = async (task: () => Promise<unknown>) => {
		setBusy(true)
		setError(null)
		try {
			await task()
			return true
		} catch (cause) {
			setError(messageOf(cause))
			return false
		} finally {
			setBusy(false)
		}
	}

	const rename = (value: string) => {
		const name = value.trim()
		if (!name || name === group.name) return
		void run(() => updateGroup(vaultId, group.id, { name }))
	}

	const changeMembers = (next: string[]) =>
		void run(() => updateGroup(vaultId, group.id, { memberIds: next }))

	const remove = async () => {
		const confirmed = await getPlatform().dialog.showConfirm({
			title: "Delete group",
			message: `Delete “${group.name}”? Access given to this group is removed too.`,
			destructive: true,
			confirmLabel: "Delete group",
		})
		if (confirmed && (await run(() => deleteGroup(vaultId, group.id)))) onDeleted()
	}

	return (
		<>
			<DialogHeader>
				<DialogTitle>{group.name}</DialogTitle>
				<DialogDescription>
					{canManage
						? formatCount(group.memberIds.length, "member")
						: `${formatCount(group.memberIds.length, "member")}. Only vault admins can change groups.`}
				</DialogDescription>
			</DialogHeader>
			<div className="form-dialog-fields">
				{canManage && (
					<div className="form-dialog-field">
						<label htmlFor="group-rename" className="form-dialog-label">
							Name
						</label>
						<Input
							key={group.name}
							id="group-rename"
							defaultValue={group.name}
							maxLength={MAX_GROUP_NAME_LENGTH}
							disabled={busy}
							onBlur={(event) => rename(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") event.currentTarget.blur()
							}}
						/>
					</div>
				)}
				<div className="form-dialog-field">
					<div className="flex items-center justify-between gap-2">
						<p className="form-dialog-label">Members</p>
						{busy && <Spinner className="size-3" />}
						{canManage && (
							<PrincipalPicker
								members={allMembers}
								excludedUserIds={memberIds}
								label="Add people"
								placeholder="Search members"
								disabled={busy}
								onSelect={(selection) => changeMembers([...group.memberIds, selection.principalId])}
							/>
						)}
					</div>
					<GroupMemberList
						groupName={group.name}
						members={groupMembers}
						canManage={canManage}
						busy={busy}
						onRemove={(userId) => changeMembers(group.memberIds.filter((id) => id !== userId))}
					/>
				</div>
				{error && <p className="settings-section-error">{error}</p>}
			</div>
			{canManage && (
				<DialogFooter className="sm:justify-start">
					<Button
						variant="ghost"
						disabled={busy}
						className="text-status-error-foreground"
						onClick={() => void remove()}
					>
						<Trash2 />
						Delete group
					</Button>
				</DialogFooter>
			)}
		</>
	)
}
