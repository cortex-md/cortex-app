import type { MoveDestination } from "@cortex/core"
import type { FileEntry } from "@cortex/platform"
import { type ColorValue, FlatList, Pressable, StyleSheet, Text } from "react-native"

import { ActionSheet } from "@/components/ui/ActionSheet"

export function MoveEntrySheet({
	destinations,
	entry,
	error,
	onDismiss,
	onMove,
	submitting,
	textColor,
}: {
	destinations: MoveDestination[]
	entry: FileEntry | null
	error: string | null
	onDismiss: () => void
	onMove: (targetParentPath: string) => void
	submitting: boolean
	textColor: ColorValue
}) {
	return (
		<ActionSheet
			isPresented={entry !== null}
			onDismiss={onDismiss}
			sectionTitle="Move to"
			spacing={12}
			supportingText={error ?? "Choose a destination folder."}
			title={entry?.name ?? "Move"}
		>
			<FlatList
				data={destinations}
				keyExtractor={(destination) => destination.path}
				renderItem={({ item }) => (
					<MoveDestinationRow
						disabled={submitting}
						label={item.label}
						onMove={onMove}
						path={item.path}
						textColor={textColor}
					/>
				)}
				style={styles.moveList}
			/>
		</ActionSheet>
	)
}

function MoveDestinationRow({
	disabled,
	label,
	onMove,
	path,
	textColor,
}: {
	disabled: boolean
	label: string
	onMove: (targetParentPath: string) => void
	path: string
	textColor: ColorValue
}) {
	return (
		<Pressable
			disabled={disabled}
			onPress={() => onMove(path)}
			style={({ pressed }) => [
				styles.moveDestination,
				{
					opacity: disabled ? 0.42 : pressed ? 0.58 : 1,
				},
			]}
		>
			<Text numberOfLines={1} style={[styles.moveDestinationText, { color: textColor }]}>
				{label}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	moveDestination: {
		borderRadius: 8,
		justifyContent: "center",
		minHeight: 44,
		paddingHorizontal: 12,
	},
	moveDestinationText: {
		fontSize: 16,
		fontWeight: "600",
		letterSpacing: 0,
		lineHeight: 21,
	},
	moveList: {
		maxHeight: 280,
	},
})
