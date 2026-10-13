import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { Avatar } from "@/components/ui/Avatar"
import { Symbol } from "@/components/ui/Symbol"
import {
	type CollabNoteSession,
	stopFollowing,
	toggleFollow,
} from "@/features/collab/collabAdapter"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"

export function PresenceRow({ session }: { session: CollabNoteSession }) {
	const { colors } = useMobileColors()
	const following = session.presence.find((entry) => entry.person.id === session.followingId)

	return (
		<View style={styles.row}>
			<View style={styles.avatars}>
				{session.presence.map(({ person }) => {
					const isFollowed = person.id === session.followingId
					return (
						<Pressable
							accessibilityLabel={
								person.isYou
									? `${person.name} (You)`
									: isFollowed
										? `Stop following ${person.name}`
										: `Follow ${person.name}`
							}
							accessibilityRole="button"
							disabled={person.isYou}
							key={person.id}
							onPress={() => {
								triggerSelectionHaptic()
								toggleFollow(person.id)
							}}
							style={[
								styles.avatar,
								{
									borderColor: isFollowed ? colors.headingBlue : colors.background,
								},
							]}
						>
							<Avatar live name={person.name} size={26} tint={person.tint} />
						</Pressable>
					)
				})}
			</View>
			{following ? (
				<View
					style={[
						styles.following,
						IS_IOS
							? { backgroundColor: colors.glass, borderColor: colors.glassEdge }
							: { backgroundColor: colors.accentSubtle, borderColor: "transparent" },
					]}
				>
					<Text
						style={[styles.followingLabel, { color: IS_IOS ? colors.headingBlue : colors.tint }]}
					>
						{`Following ${following.person.name.split(" ")[0]}`}
					</Text>
					<Pressable
						accessibilityLabel={`Stop following ${following.person.name}`}
						accessibilityRole="button"
						hitSlop={8}
						onPress={stopFollowing}
						style={styles.stop}
					>
						<Text style={[styles.stopLabel, { color: colors.label }]}>Stop</Text>
						<Symbol color={colors.label} name={{ sf: "xmark", md: "close" }} size={14} />
					</Pressable>
				</View>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	avatar: {
		borderRadius: 999,
		borderWidth: 2,
		marginLeft: -4,
	},
	avatars: {
		flexDirection: "row",
		paddingLeft: 4,
	},
	following: {
		alignItems: "center",
		borderRadius: IS_IOS ? 999 : 8,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 10,
		height: 32,
		paddingHorizontal: 12,
	},
	followingLabel: {
		fontSize: 14,
		fontWeight: "600",
		lineHeight: 18,
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		justifyContent: "space-between",
		minHeight: 44,
		paddingHorizontal: 16,
	},
	stop: {
		alignItems: "center",
		flexDirection: "row",
		gap: 2,
	},
	stopLabel: {
		fontSize: 14,
		fontWeight: "500",
		lineHeight: 18,
	},
})
