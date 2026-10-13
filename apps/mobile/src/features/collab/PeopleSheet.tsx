import { Stack } from "expo-router"
import { useState } from "react"
import { Alert, Platform } from "react-native"

import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import {
	cancelInvite,
	copyNoteLink,
	inviteToVault,
	listNotePeople,
	setLinkSharing,
	toggleFollow,
	useCollabNoteSession,
	useLinkSharing,
	usePendingInvites,
} from "@/features/collab/collabAdapter"
import type { CollabRole } from "@/features/collab/collabFixtures"
import { toast } from "@/features/feedback/useToast"
import { dismissSheet, openSettings } from "@/features/navigation/routes"
import { useSheetFilePath } from "@/features/note/noteSheetParams"
import { FormMenu, FormTextField } from "@/features/sync/FormControls"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INVITE_ROLES: CollabRole[] = ["Editor", "Viewer"]

function confirmCancelInvite(id: string, email: string) {
	Alert.alert(`Cancel the invite for ${email}?`, undefined, [
		{ style: "cancel", text: "Keep" },
		{ onPress: () => cancelInvite(id), style: "destructive", text: "Cancel invite" },
	])
}

export function PeopleSheet() {
	const filePath = useSheetFilePath()
	const session = useCollabNoteSession(filePath)
	const pendingInvites = usePendingInvites()
	const linkSharing = useLinkSharing(filePath)
	const [email, setEmail] = useState("")
	const [fieldKey, setFieldKey] = useState(0)
	const [role, setRole] = useState<CollabRole>("Editor")
	const emailValid = EMAIL_PATTERN.test(email.trim())
	const editing = session.presence.filter((entry) => !entry.person.isYou)
	const people = listNotePeople()

	const invite = () => {
		if (!emailValid) return
		triggerSelectionHaptic()
		const value = email.trim()
		inviteToVault(value, role)
		setEmail("")
		setFieldKey((key) => key + 1)
		toast(`Invited ${value}`)
	}

	const copyLink = () => {
		if (!filePath) return
		void copyNoteLink(filePath).then(() => toast("Link copied"))
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: "Share",
					headerRight: IS_IOS
						? undefined
						: () => (
								<HeaderIconButton
									accessibilityLabel="Close"
									icon={{ sf: "xmark", md: "close" }}
									onPress={dismissSheet}
								/>
							),
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button onPress={dismissSheet} variant="done">
						Done
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
			<NativeForm>
				<FormSection footer="Editors can change notes. Viewers can read and search." title="Invite">
					<FormTextField
						key={fieldKey}
						keyboard="email"
						onChangeText={setEmail}
						onSubmit={invite}
						placeholder="name@example.com"
					/>
					<FormRow
						title="Role"
						trailing={
							<FormMenu
								accessibilityLabel="Invite role"
								groups={[
									INVITE_ROLES.map((option) => ({
										checked: option === role,
										key: option,
										label: option,
										onPress: () => setRole(option),
									})),
								]}
								label={role}
							/>
						}
					/>
					<FormRow disabled={!emailValid} onPress={invite} tint title="Send invite" />
				</FormSection>
				{editing.length > 0 ? (
					<FormSection title="Editing now">
						{editing.map(({ person, section }) => (
							<FormRow
								icon={{ sf: "person.crop.circle", md: "account_circle" }}
								key={person.id}
								onPress={() => toggleFollow(person.id)}
								subtitle={section}
								title={person.name}
								tint={session.followingId === person.id}
								value={session.followingId === person.id ? "Following" : "Follow"}
							/>
						))}
					</FormSection>
				) : null}
				<FormSection title="People with access">
					{people.map((person) => (
						<FormRow
							icon={{ sf: "person.crop.circle", md: "account_circle" }}
							key={person.id}
							subtitle={person.isYou ? "You" : undefined}
							title={person.name}
							value={person.role}
						/>
					))}
					{pendingInvites.map((pending) => (
						<FormRow
							icon={{ sf: "envelope", md: "mail" }}
							key={pending.id}
							onPress={() => confirmCancelInvite(pending.id, pending.email)}
							subtitle={pending.expiresLabel}
							title={pending.email}
							value="Pending"
						/>
					))}
					<FormRow
						chevron
						onPress={() => {
							dismissSheet()
							openSettings("sync/members")
						}}
						title="Manage members"
					/>
				</FormSection>
				<FormSection title="Link">
					<FormToggle
						disabled={!filePath}
						onValueChange={(value) => {
							if (filePath) setLinkSharing(filePath, value)
						}}
						subtitle="Vault members with the link can open this note"
						title="Share with link"
						value={linkSharing}
					/>
					{linkSharing ? (
						<FormRow icon={{ sf: "link", md: "link" }} onPress={copyLink} tint title="Copy link" />
					) : null}
				</FormSection>
			</NativeForm>
		</>
	)
}
