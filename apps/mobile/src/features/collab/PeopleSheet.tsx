import { getNoteTitle } from "@cortex/platform/utils"
import { ChevronDown, Users } from "lucide-react-native"
import { useState } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"

import { Avatar } from "@/components/ui/Avatar"
import {
	GroupedFooter,
	GroupedList,
	GroupedRow,
	GroupedSectionHeader,
} from "@/components/ui/GroupedList"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { SheetHeader } from "@/components/ui/SheetHeader"
import {
	cancelInvite,
	getCollabVaultName,
	getCurrentPerson,
	inviteToVault,
	listNotePeople,
	toggleFollow,
	useCollabNoteSession,
	usePendingInvites,
} from "@/features/collab/collabAdapter"
import type { CollabRole } from "@/features/collab/collabFixtures"
import { toast } from "@/features/feedback/useToast"
import { dismissSheet, openSettings } from "@/features/navigation/routes"
import { useSheetFilePath } from "@/features/note/noteSheetParams"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const inviteRoles: CollabRole[] = ["Editor", "Viewer"]

function FollowButton({ following, onPress }: { following: boolean; onPress: () => void }) {
	const { colors } = useMobileColors()
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected: following }}
			android_ripple={{ color: colors.hover }}
			onPress={onPress}
			style={[
				styles.followButton,
				{ backgroundColor: following ? colors.tintFill : IS_IOS ? colors.fill : colors.accentSubtle },
			]}
		>
			<Text style={[styles.followLabel, { color: following ? colors.onTint : IS_IOS ? colors.label : colors.tint }]}>
				{following ? "Following" : "Follow"}
			</Text>
		</Pressable>
	)
}

export function PeopleSheet() {
	const { colors } = useMobileColors()
	const filePath = useSheetFilePath()
	const session = useCollabNoteSession(filePath)
	const pendingInvites = usePendingInvites()
	const [email, setEmail] = useState("")
	const [role, setRole] = useState<CollabRole>("Editor")
	const vaultName = getCollabVaultName()
	const title = filePath ? getNoteTitle(filePath) : "Note"
	const you = getCurrentPerson()
	const presence = session.live ? session.presence : [{ person: you, section: "" }]
	const presentIds = new Set(presence.map((entry) => entry.person.id))
	const canOpen = listNotePeople().filter((person) => !presentIds.has(person.id))
	const emailValid = EMAIL_PATTERN.test(email.trim())

	function invite() {
		if (!emailValid) return
		triggerSelectionHaptic()
		const value = email.trim()
		inviteToVault(value, role)
		setEmail("")
		toast(`Invited ${value}`)
	}

	const roleMenu = (
		<NativeMenu
			accessibilityLabel="Invite role"
			anchorStyle="plain"
			groups={[
				inviteRoles.map((option) => ({
					key: option,
					label: option,
					checked: option === role,
					onPress: () => setRole(option),
				})),
			]}
			title={`${role} ▾`}
		/>
	)

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<SheetHeader onClose={IS_IOS ? dismissSheet : undefined} title={`Share "${title}"`} />
			<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
				<GroupedSectionHeader>In this note now</GroupedSectionHeader>
				<GroupedList>
					{presence.map(({ person, section }) => (
						<GroupedRow
							key={person.id}
							leading={<Avatar live={session.live} name={person.name} size={36} tint={person.tint} />}
							subtitle={person.isYou ? "You · editing" : `Editing · ${section}`}
							title={person.name}
							trailing={
								person.isYou ? null : (
									<FollowButton
										following={session.followingId === person.id}
										onPress={() => toggleFollow(person.id)}
									/>
								)
							}
						/>
					))}
				</GroupedList>
				{IS_IOS ? (
					<GroupedFooter>Following scrolls with that person as they move through the note.</GroupedFooter>
				) : null}

				<GroupedSectionHeader>{`Invite to ${vaultName}`}</GroupedSectionHeader>
				{IS_IOS ? (
					<GroupedList>
						<View style={styles.inviteRow}>
							<TextInput
								accessibilityLabel="Email"
								autoCapitalize="none"
								autoCorrect={false}
								keyboardType="email-address"
								onChangeText={setEmail}
								onSubmitEditing={invite}
								placeholder="name@example.com"
								placeholderTextColor={colors.secondaryLabel}
								style={[styles.inviteInput, { color: colors.label }]}
								value={email}
							/>
							{roleMenu}
							<Pressable
								accessibilityRole="button"
								disabled={!emailValid}
								onPress={invite}
								style={[
									styles.inviteButton,
									{ backgroundColor: colors.tintFill },
									emailValid ? null : styles.disabled,
								]}
							>
								<Text style={[styles.inviteLabel, { color: colors.onTint }]}>Invite</Text>
							</Pressable>
						</View>
					</GroupedList>
				) : (
					<View style={styles.androidInvite}>
						<TextInput
							accessibilityLabel="Email"
							autoCapitalize="none"
							autoCorrect={false}
							keyboardType="email-address"
							onChangeText={setEmail}
							placeholder="Email"
							placeholderTextColor={colors.secondaryLabel}
							style={[styles.outlined, { borderColor: colors.tertiaryLabel, color: colors.label }]}
							value={email}
						/>
						<View style={[styles.outlined, styles.outlinedRole, { borderColor: colors.tertiaryLabel }]}>
							<Text style={[styles.roleLabel, { color: colors.label }]}>{role}</Text>
							<NativeMenu
								accessibilityLabel="Invite role"
								groups={[
									inviteRoles.map((option) => ({
										key: option,
										label: option,
										checked: option === role,
										onPress: () => setRole(option),
									})),
								]}
								icon={{ sf: "chevron.down", Lucide: ChevronDown }}
							/>
						</View>
						<Pressable
							accessibilityRole="button"
							android_ripple={{ color: colors.hover }}
							disabled={!emailValid}
							onPress={invite}
							style={[
								styles.androidInviteButton,
								{ backgroundColor: colors.tintFill },
								emailValid ? null : styles.disabled,
							]}
						>
							<Text style={[styles.inviteLabel, { color: colors.onTint }]}>Invite</Text>
						</Pressable>
					</View>
				)}
				<GroupedFooter>Editors can change notes. Viewers can read and search.</GroupedFooter>

				{pendingInvites.length > 0 ? (
					<>
						<GroupedSectionHeader>Pending</GroupedSectionHeader>
						<GroupedList>
							{pendingInvites.map((pending) => (
								<GroupedRow
									key={pending.id}
									subtitle={pending.expiresLabel}
									title={pending.email}
									trailing={
										<Pressable
											accessibilityRole="button"
											hitSlop={6}
											onPress={() => cancelInvite(pending.id)}
										>
											<Text style={[styles.cancelLabel, { color: colors.destructiveText }]}>Cancel</Text>
										</Pressable>
									}
								/>
							))}
						</GroupedList>
					</>
				) : null}

				<GroupedSectionHeader>Can open this note</GroupedSectionHeader>
				<GroupedList>
					{canOpen.map((person) => (
						<GroupedRow
							key={person.id}
							leading={<Avatar name={person.name} size={36} tint={person.tint} />}
							title={person.name}
							value={person.role}
						/>
					))}
					<GroupedRow
						chevron
						leading={<Users color={colors.tint} size={22} strokeWidth={2} />}
						onPress={() => {
							dismissSheet()
							openSettings("sync/members")
						}}
						tint
						title={`All members of ${vaultName}`}
					/>
				</GroupedList>
				<GroupedFooter>
					{`Access is set per vault: everyone in ${vaultName}'s Sync group can open its notes.`}
				</GroupedFooter>
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	androidInvite: {
		gap: 12,
		marginHorizontal: 16,
	},
	androidInviteButton: {
		alignItems: "center",
		borderRadius: 999,
		height: 48,
		justifyContent: "center",
		overflow: "hidden",
	},
	cancelLabel: {
		fontSize: 15,
		fontWeight: "600",
		lineHeight: 20,
	},
	content: {
		paddingBottom: 40,
	},
	disabled: {
		opacity: 0.4,
	},
	followButton: {
		alignItems: "center",
		borderRadius: 999,
		height: 32,
		justifyContent: "center",
		overflow: "hidden",
		paddingHorizontal: 14,
	},
	followLabel: {
		fontSize: 15,
		fontWeight: "600",
		lineHeight: 20,
	},
	inviteButton: {
		alignItems: "center",
		borderRadius: 999,
		height: 34,
		justifyContent: "center",
		paddingHorizontal: 14,
	},
	inviteInput: {
		flex: 1,
		fontSize: 17,
		lineHeight: 22,
		minWidth: 0,
		padding: 0,
	},
	inviteLabel: {
		fontSize: 15,
		fontWeight: "600",
		lineHeight: 20,
	},
	inviteRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		minHeight: 52,
		paddingHorizontal: 16,
	},
	outlined: {
		borderRadius: 4,
		borderWidth: 1,
		fontSize: 16,
		height: 56,
		paddingHorizontal: 16,
	},
	outlinedRole: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingRight: 4,
	},
	roleLabel: {
		fontSize: 16,
		lineHeight: 24,
	},
	root: {
		flex: 1,
	},
})
