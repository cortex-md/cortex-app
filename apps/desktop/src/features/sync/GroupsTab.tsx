import { useMembersStore } from "@cortex/core"
import type { VaultGroup } from "@cortex/platform"
import {
	Button,
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@cortex/ui"
import { ChevronRightIcon, PlusIcon, UsersIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { formatCount } from "@/utils/format"
import { SettingsGroup, SettingsIconTile, SettingsList } from "../settings/SettingsPrimitives"
import { GroupDialog, type GroupDialogTarget } from "./GroupDialog"
import { memberDisplayName, useMemberDirectory } from "./memberDirectory"
import { type FacepileUser, UserFacepile } from "./UserAvatar"

interface GroupsTabProps {
	vaultId: string
	canManage: boolean
}

export function GroupsTab({ vaultId, canManage }: GroupsTabProps) {
	const groups = useMembersStore((state) => state.groups)
	const [target, setTarget] = useState<GroupDialogTarget | null>(null)
	const openCreate = () => setTarget({ kind: "create" })

	return (
		<>
			<div className="members-tab-header">
				<span className="members-tab-count">
					Groups let you give access to several people at once from Share or Manage access.
				</span>
				{canManage && groups.length > 0 && (
					<Button size="sm" onClick={openCreate}>
						<PlusIcon />
						New group
					</Button>
				)}
			</div>
			{groups.length === 0 ? (
				<Empty className="members-empty">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<UsersIcon />
						</EmptyMedia>
						<EmptyTitle>No groups yet</EmptyTitle>
						<EmptyDescription>
							{canManage
								? "Create a group like “Design” and share folders with everyone in it."
								: "Vault admins can create groups."}
						</EmptyDescription>
					</EmptyHeader>
					{canManage && (
						<EmptyContent>
							<Button size="sm" onClick={openCreate}>
								<PlusIcon />
								New group
							</Button>
						</EmptyContent>
					)}
				</Empty>
			) : (
				<SettingsGroup>
					<SettingsList>
						{groups.map((group) => (
							<GroupRow
								key={group.id}
								group={group}
								onOpen={() => setTarget({ kind: "edit", groupId: group.id })}
							/>
						))}
					</SettingsList>
				</SettingsGroup>
			)}
			<GroupDialog
				vaultId={vaultId}
				canManage={canManage}
				target={target}
				onClose={() => setTarget(null)}
			/>
		</>
	)
}

function GroupRow({ group, onOpen }: { group: VaultGroup; onOpen(): void }) {
	const directory = useMemberDirectory()
	const facepile = useMemo<FacepileUser[]>(
		() =>
			group.memberIds.flatMap((memberId) => {
				const member = directory.get(memberId)
				return member
					? [
							{
								userId: member.userId,
								name: memberDisplayName(member),
								avatarUrl: member.avatarUrl,
							},
						]
					: []
			}),
		[directory, group.memberIds],
	)
	return (
		<button
			type="button"
			data-settings-row=""
			data-has-icon="true"
			className="settings-list-item group members-group-row"
			onClick={onOpen}
		>
			<SettingsIconTile>
				<UsersIcon />
			</SettingsIconTile>
			<span className="settings-member-copy">
				<span className="settings-field-label">{group.name}</span>
				<span className="settings-field-description">
					{formatCount(group.memberIds.length, "member")}
				</span>
			</span>
			<span className="settings-row-trail">
				<UserFacepile users={facepile} label={`Members of ${group.name}`} />
				<ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
			</span>
		</button>
	)
}
