import { Stack } from "expo-router"
import { useState } from "react"
import { SectionList, StyleSheet, Text } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import {
	deletedMomentLabel,
	groupDeletedNotes,
	useDeletedNotes,
} from "@/features/history/deletedNotesAdapter"
import { InsetListRow, InsetSectionHeader } from "@/features/history/InsetListRow"
import { openSettings } from "@/features/navigation/routes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function DeletedNotesScreen() {
	const { colors } = useMobileColors()
	const { error, loading, notes } = useDeletedNotes()
	const [query, setQuery] = useState("")
	const normalized = query.trim().toLowerCase()
	const visible = normalized
		? notes.filter((note) => note.title.toLowerCase().includes(normalized))
		: notes
	const sections = groupDeletedNotes(visible).map((group) => ({
		data: group.notes,
		title: group.label,
	}))

	return (
		<>
			<Stack.Screen options={{ title: "Deleted notes" }} />
			<Stack.SearchBar
				onCancelButtonPress={() => setQuery("")}
				onChangeText={(event) => setQuery(event.nativeEvent.text)}
				placeholder="Search deleted notes"
			/>
			<SectionList
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				keyboardDismissMode="on-drag"
				keyExtractor={(note) => note.id}
				ListEmptyComponent={
					<EmptyState
						icon={{ sf: "trash", md: "delete" }}
						title={
							loading
								? "Loading deleted notes…"
								: (error ?? (notes.length === 0 ? "No deleted notes" : "No matching notes"))
						}
					/>
				}
				renderItem={({ index, item, section }) => (
					<InsetListRow
						chevron
						first={index === 0}
						last={index === section.data.length - 1}
						onPress={() => openSettings("deleted-note", { id: item.id })}
						subtitle={item.folder}
						title={item.title}
						trailing={
							<Text style={[styles.retention, { color: colors.secondaryLabel }]}>
								{deletedMomentLabel(item)}
							</Text>
						}
					/>
				)}
				renderSectionHeader={({ section }) => <InsetSectionHeader title={section.title} />}
				sections={sections}
				stickySectionHeadersEnabled={false}
				style={{ backgroundColor: colors.groupedBackground }}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 40,
	},
	retention: {
		fontSize: 13,
		lineHeight: 18,
	},
})
