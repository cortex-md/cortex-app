import type { NoteHeading } from "@cortex/core"
import { Platform, Pressable, StyleSheet, Text } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedList } from "@/components/ui/GroupedList"
import { dismissSheet } from "@/features/navigation/routes"
import { revealHeading } from "@/features/note/useNoteOutline"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function NoteOutlineList({ headings }: { headings: NoteHeading[] }) {
	const { colors } = useMobileColors()
	if (headings.length === 0) {
		return <EmptyState description="Add headings to see them here." title="No headings" />
	}
	const minLevel = Math.min(...headings.map((heading) => heading.level))
	return (
		<GroupedList>
			{headings.map((heading) => (
				<Pressable
					accessibilityRole="button"
					android_ripple={{ color: colors.hover }}
					key={`${heading.line}-${heading.text}`}
					onPress={() => {
						revealHeading(heading)
						dismissSheet()
					}}
					style={({ pressed }) => [
						styles.row,
						{
							backgroundColor: pressed && IS_IOS ? colors.hover : "transparent",
							paddingLeft: 16 + (heading.level - minLevel) * 18,
						},
					]}
				>
					<Text
						numberOfLines={1}
						style={[
							styles.label,
							{
								color: colors.label,
								fontWeight: heading.level === minLevel ? "600" : "400",
							},
						]}
					>
						{heading.text}
					</Text>
				</Pressable>
			))}
		</GroupedList>
	)
}

const styles = StyleSheet.create({
	label: {
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: IS_IOS ? 22 : 24,
	},
	row: {
		justifyContent: "center",
		minHeight: IS_IOS ? 44 : 48,
		paddingRight: 16,
	},
})
