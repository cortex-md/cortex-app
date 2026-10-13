import { useRemoteVaultStore, useVaultStore } from "@cortex/core"
import { useState } from "react"
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native"

import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import { GroupedList, GroupedRow } from "@/components/ui/GroupedList"
import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import {
	cancelInvite,
	changeMemberRole,
	inviteMember,
	removeMember,
	roleLabel,
	useVaultMembers,
} from "@/features/members/membersAdapter"
import type { MemberRole } from "@/features/members/membersFixtures"
import {
	ActionButton,
	SettingsBlock,
	SettingsFooterText,
	SettingsPage,
} from "@/features/sync/SettingsPage"
import { resolveLinkedRemoteVault } from "@/features/sync/syncAdapter"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

const INVITE_ROLES: MemberRole[] = ["editor", "viewer"]

function roleMenuGroups(current: MemberRole, onPick: (role: MemberRole) => void): MenuGroup {
	return INVITE_ROLES.map((role) => ({
		key: role,
		label: roleLabel(role),
		checked: role === current,
		onPress: () => onPick(role),
	}))
}

export function MembersScreen() {
	const { colors } = useMobileColors()
	const vault = useVaultStore((state) => state.vault)
	const remoteVaults = useRemoteVaultStore((state) => state.remoteVaults)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const { members, pending } = useVaultMembers()
	const [email, setEmail] = useState("")
	const [inviteRole, setInviteRole] = useState<MemberRole>("editor")

	const remoteName =
		resolveLinkedRemoteVault(remoteVaults, linkedVaultId, syncConfig)?.name ?? vault?.name ?? "Work"
	const canInvite = /\S+@\S+\.\S+/.test(email.trim())

	const submitInvite = () => {
		if (!canInvite) return
		inviteMember(email.trim(), inviteRole)
		setEmail("")
	}

	const roleMenu = (
		<NativeMenu
			accessibilityLabel="Invite role"
			anchorStyle="plain"
			groups={[roleMenuGroups(inviteRole, setInviteRole)]}
			title={roleLabel(inviteRole)}
		/>
	)

	return (
		<SettingsPage subtitle={`People who can open the remote copy of ${remoteName}.`}>
			<SettingsBlock title="Invite">
				{IS_IOS ? (
					<View style={[styles.inviteCard, { backgroundColor: colors.cell }]}>
						<TextInput
							autoCapitalize="none"
							autoComplete="email"
							autoCorrect={false}
							keyboardType="email-address"
							onChangeText={setEmail}
							onSubmitEditing={submitInvite}
							placeholder="name@example.com"
							placeholderTextColor={colors.placeholder}
							returnKeyType="send"
							style={[styles.inlineInput, { color: colors.label }]}
							value={email}
						/>
						{roleMenu}
						<ActionButton disabled={!canInvite} label="Invite" onPress={submitInvite} variant="text" />
					</View>
				) : (
					<View style={styles.inviteForm}>
						<TextInput
							autoCapitalize="none"
							autoComplete="email"
							autoCorrect={false}
							keyboardType="email-address"
							onChangeText={setEmail}
							onSubmitEditing={submitInvite}
							placeholder="name@example.com"
							placeholderTextColor={colors.placeholder}
							returnKeyType="send"
							style={[styles.outlinedInput, { borderColor: colors.border, color: colors.label }]}
							value={email}
						/>
						<View style={[styles.outlinedInput, styles.roleField, { borderColor: colors.border }]}>
							<Text style={[styles.roleLabel, { color: colors.secondaryLabel }]}>Role</Text>
							{roleMenu}
						</View>
						<ActionButton disabled={!canInvite} label="Invite" onPress={submitInvite} wide />
					</View>
				)}
				<SettingsFooterText>
					Editors can change notes. Viewers can read and search.
				</SettingsFooterText>
			</SettingsBlock>

			<SettingsBlock title={`Members · ${members.length}`}>
				<GroupedList>
					{members.map((member) => (
						<GroupedRow
							key={member.id}
							leading={<Avatar name={member.name} size={36} tint={member.avatarTint} />}
							subtitle={member.isYou ? `${member.email} · You` : `${member.email} · ${member.joinedLabel}`}
							title={member.name}
							trailing={
								member.role === "owner" ? (
									<Badge label="Owner" tint />
								) : (
									<NativeMenu
										accessibilityLabel={`Role for ${member.name}`}
										anchorStyle="plain"
										groups={[
											roleMenuGroups(member.role, (role) => changeMemberRole(member.id, role)),
											[
												{
													key: "remove",
													label: `Remove from ${remoteName}`,
													destructive: true,
													onPress: () => removeMember(member.id),
												},
											],
										]}
										title={roleLabel(member.role)}
									/>
								)
							}
						/>
					))}
				</GroupedList>
			</SettingsBlock>

			{pending.length > 0 ? (
				<SettingsBlock title={`Pending · ${pending.length}`}>
					<GroupedList>
						{pending.map((invite) => (
							<GroupedRow
								key={invite.id}
								subtitle={`${roleLabel(invite.role)} · ${invite.expiresLabel}`}
								title={invite.email}
								trailing={
									<Pressable
										accessibilityLabel={`Cancel invite for ${invite.email}`}
										hitSlop={8}
										onPress={() => cancelInvite(invite.id)}
									>
										<Text style={[styles.cancel, { color: colors.tint }]}>Cancel</Text>
									</Pressable>
								}
							/>
						))}
					</GroupedList>
				</SettingsBlock>
			) : null}
		</SettingsPage>
	)
}

const styles = StyleSheet.create({
	cancel: {
		fontSize: 15,
		fontWeight: "500",
		lineHeight: 20,
	},
	inlineInput: {
		flex: 1,
		fontSize: 17,
		lineHeight: 22,
		minHeight: 44,
		minWidth: 0,
		padding: 0,
	},
	inviteCard: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 26,
		flexDirection: "row",
		gap: 8,
		marginHorizontal: 16,
		paddingLeft: 16,
		paddingRight: 8,
		paddingVertical: 4,
	},
	inviteForm: {
		gap: 12,
		marginHorizontal: 16,
	},
	outlinedInput: {
		borderRadius: 8,
		borderWidth: 1,
		fontSize: 16,
		letterSpacing: 0.5,
		minHeight: 56,
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	roleField: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
	},
	roleLabel: {
		fontSize: 16,
		letterSpacing: 0.5,
	},
})
