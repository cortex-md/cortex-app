import { useState } from "react"
import { Alert } from "react-native"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import type { MenuGroup } from "@/components/ui/menuTypes"
import { TextPromptDialog } from "@/components/ui/TextPromptDialog"
import {
	cancelInvite,
	changeMemberRole,
	createGroup,
	deleteGroup,
	inviteMember,
	removeMember,
	roleLabel,
	useVaultMembers,
} from "@/features/members/membersAdapter"
import type { MemberRole } from "@/features/members/memberTypes"
import { FormMenu, FormTextField } from "@/features/sync/FormControls"

const INVITE_ROLES: MemberRole[] = ["editor", "viewer"]
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function roleMenuGroup(current: MemberRole, onPick: (role: MemberRole) => void): MenuGroup {
	return INVITE_ROLES.map((role) => ({
		key: role,
		label: roleLabel(role),
		checked: role === current,
		onPress: () => onPick(role),
	}))
}

function confirmRemoveMember(id: string, name: string) {
	Alert.alert(`Remove ${name}?`, "They lose access to this vault on every device.", [
		{ style: "cancel", text: "Cancel" },
		{ onPress: () => removeMember(id), style: "destructive", text: "Remove" },
	])
}

function confirmDeleteGroup(id: string, name: string) {
	Alert.alert(
		`Delete ${name}?`,
		"Members keep their own access; rules for this group are removed.",
		[
			{ style: "cancel", text: "Cancel" },
			{ onPress: () => deleteGroup(id), style: "destructive", text: "Delete" },
		],
	)
}

function confirmCancelInvite(id: string, email: string) {
	Alert.alert(`Cancel the invite for ${email}?`, undefined, [
		{ style: "cancel", text: "Keep" },
		{ onPress: () => cancelInvite(id), style: "destructive", text: "Cancel invite" },
	])
}

export function MembersScreen() {
	const { groups, members, pending } = useVaultMembers()
	const [naming, setNaming] = useState(false)
	const [email, setEmail] = useState("")
	const [fieldKey, setFieldKey] = useState(0)
	const [inviteRole, setInviteRole] = useState<MemberRole>("editor")
	const canInvite = EMAIL_PATTERN.test(email.trim())

	const submitInvite = () => {
		if (!canInvite) return
		inviteMember(email.trim(), inviteRole)
		setEmail("")
		setFieldKey((key) => key + 1)
	}

	return (
		<>
			<NativeForm>
				<FormSection footer="Editors can change notes. Viewers can read and search." title="Invite">
					<FormTextField
						key={fieldKey}
						keyboard="email"
						onChangeText={setEmail}
						onSubmit={submitInvite}
						placeholder="name@example.com"
					/>
					<FormRow
						title="Role"
						trailing={
							<FormMenu
								accessibilityLabel="Invite role"
								groups={[roleMenuGroup(inviteRole, setInviteRole)]}
								label={roleLabel(inviteRole)}
							/>
						}
					/>
					<FormRow disabled={!canInvite} onPress={submitInvite} tint title="Send invite" />
				</FormSection>
				<FormSection title="Members">
					{members.map((member) => (
						<FormRow
							icon={{ sf: "person.crop.circle", md: "account_circle" }}
							key={member.id}
							subtitle={member.isYou ? `${member.email} · You` : member.email}
							title={member.name}
							trailing={
								member.role === "owner" ? undefined : (
									<FormMenu
										accessibilityLabel={`Role for ${member.name}`}
										groups={[
											roleMenuGroup(member.role, (role) => changeMemberRole(member.id, role)),
											[
												{
													key: "remove",
													label: "Remove",
													destructive: true,
													onPress: () => confirmRemoveMember(member.id, member.name),
												},
											],
										]}
										label={roleLabel(member.role)}
									/>
								)
							}
							value={member.role === "owner" ? roleLabel(member.role) : undefined}
						/>
					))}
				</FormSection>
				{pending.length > 0 ? (
					<FormSection title="Pending invites">
						{pending.map((invite) => (
							<FormRow
								icon={{ sf: "envelope", md: "mail" }}
								key={invite.id}
								onPress={() => confirmCancelInvite(invite.id, invite.email)}
								subtitle={`${roleLabel(invite.role)} · ${invite.expiresLabel}`}
								title={invite.email}
							/>
						))}
					</FormSection>
				) : null}
				<FormSection footer="Groups share access rules in a vault." title="Groups">
					{groups.map((group) => (
						<FormRow
							icon={{ sf: "person.3", md: "groups" }}
							key={group.id}
							onPress={() => confirmDeleteGroup(group.id, group.name)}
							title={group.name}
							value={`${group.memberCount}`}
						/>
					))}
					<FormRow
						icon={{ sf: "plus", md: "add" }}
						onPress={() => setNaming(true)}
						tint
						title="New group"
					/>
				</FormSection>
			</NativeForm>
			<TextPromptDialog
				confirmLabel="Create"
				onCancel={() => setNaming(false)}
				onConfirm={(name) => {
					setNaming(false)
					if (name.trim()) createGroup(name.trim())
				}}
				placeholder="Group name"
				title="New group"
				visible={naming}
			/>
		</>
	)
}
