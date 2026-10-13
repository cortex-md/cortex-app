import { FileText, Trash2 } from "lucide-react-native"
import { useState } from "react"
import { Platform, SectionList, StyleSheet, Text, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedFooter, GroupedRow, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { SearchField } from "@/components/ui/SearchField"
import {
	type DeletedNote,
	groupDeletedNotes,
	retentionLabel,
	useDeletedNotes,
} from "@/features/history/deletedNotesAdapter"
import { openSettings } from "@/features/navigation/routes"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

function DeletedNoteRow({ first, last, note }: { first: boolean; last: boolean; note: DeletedNote }) {
	const { colors } = useMobileColors()
	return (
		<View
			style={[
				styles.cell,
				{ backgroundColor: colors.cell },
				first ? styles.cellFirst : null,
				last ? styles.cellLast : null,
				!IS_IOS && !last ? styles.m3Gap : null,
			]}
		>
			<GroupedRow
				chevron={IS_IOS}
				leading={IS_IOS ? undefined : <FileText color={colors.secondaryLabel} size={24} strokeWidth={2} />}
				onPress={() => openSettings("deleted-note", { id: note.id })}
				subtitle={note.folder}
				title={note.title}
				trailing={
					<Text
						style={[
							styles.retention,
							{ color: note.expiresSoon ? colors.warningText : colors.secondaryLabel },
						]}
					>
						{retentionLabel(note)}
					</Text>
				}
			/>
			{IS_IOS && !last ? <View style={[styles.separator, { backgroundColor: colors.separator }]} /> : null}
		</View>
	)
}

export function DeletedNotesScreen() {
	const { colors } = useMobileColors()
	const notes = useDeletedNotes()
	const [query, setQuery] = useState("")
	const normalized = query.trim().toLowerCase()
	const visible = normalized ? notes.filter((note) => note.title.toLowerCase().includes(normalized)) : notes
	const sections = groupDeletedNotes(visible).map((group) => ({ label: group.label, data: group.notes }))

	return (
		<SectionList
			contentContainerStyle={styles.content}
			contentInsetAdjustmentBehavior="automatic"
			keyboardDismissMode="on-drag"
			keyExtractor={(note) => note.id}
			ListEmptyComponent={<EmptyState Icon={Trash2} title="No deleted notes" />}
			ListFooterComponent={
				<GroupedFooter>Deleted notes are kept on Cortex Sync for a while, from any device.</GroupedFooter>
			}
			ListHeaderComponent={
				<View style={styles.search}>
					<SearchField
						onChangeText={setQuery}
						onClear={() => setQuery("")}
						placeholder="Search deleted notes"
						value={query}
					/>
				</View>
			}
			renderItem={({ index, item, section }) => (
				<DeletedNoteRow first={index === 0} last={index === section.data.length - 1} note={item} />
			)}
			renderSectionHeader={({ section }) => (
				<GroupedSectionHeader>{IS_IOS ? section.label.toUpperCase() : section.label}</GroupedSectionHeader>
			)}
			sections={sections}
			stickySectionHeadersEnabled={false}
			style={{ backgroundColor: colors.groupedBackground }}
		/>
	)
}

const styles = StyleSheet.create({
	cell: {
		borderCurve: "continuous",
		marginHorizontal: 16,
		overflow: "hidden",
	},
	cellFirst: {
		borderTopLeftRadius: IS_IOS ? 26 : 20,
		borderTopRightRadius: IS_IOS ? 26 : 20,
	},
	cellLast: {
		borderBottomLeftRadius: IS_IOS ? 26 : 20,
		borderBottomRightRadius: IS_IOS ? 26 : 20,
	},
	content: {
		paddingBottom: 40,
	},
	m3Gap: {
		marginBottom: 2,
	},
	retention: {
		fontSize: IS_IOS ? 15 : 12,
		lineHeight: 20,
	},
	search: {
		marginTop: 8,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		marginLeft: 16,
	},
})
