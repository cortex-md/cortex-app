import type { FolderNoteCount, TagEntry } from "@cortex/core"
import { useSearchStore } from "@cortex/search"
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedList, GroupedRow, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { SymbolIcon } from "@/components/ui/Symbol"
import {
	formatFilter,
	parseQueryState,
	SEARCH_OPERATORS,
	type SearchMode,
	type SearchQueryState,
} from "@/features/search/searchQuery"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

const IS_IOS = Platform.OS === "ios"

function RecentQueryRow({
	colors,
	onPress,
	raw,
}: {
	colors: MobileColors
	onPress: () => void
	raw: string
}) {
	const parsed = parseQueryState(raw)
	return (
		<GroupedRow
			leading={
				<SymbolIcon
					color={colors.tertiaryLabel}
					name={{ md: "history", sf: "clock.arrow.circlepath" }}
					size={IS_IOS ? 18 : 24}
				/>
			}
			onPress={onPress}
			title={parsed.text || raw}
			trailing={
				parsed.filters.length > 0 ? (
					<View style={styles.recentTokens}>
						{parsed.filters.map((filter) => (
							<Badge key={formatFilter(filter)} label={formatFilter(filter)} tint />
						))}
					</View>
				) : null
			}
		/>
	)
}

export function SearchSuggestions({
	folders,
	mode,
	onApplyQuery,
	onReplaceActiveWord,
	tags,
}: {
	folders: readonly FolderNoteCount[]
	mode: Exclude<SearchMode, { kind: "results" }>
	onApplyQuery: (state: SearchQueryState) => void
	onReplaceActiveWord: (replacement: string) => void
	tags: readonly TagEntry[]
}) {
	const { colors } = useMobileColors()
	const recentQueries = useSearchStore((state) => state.recentQueries)
	const prefix = mode.kind === "values" ? mode.prefix.toLowerCase() : ""
	const matchingFolders =
		mode.kind === "values" && mode.key === "path"
			? folders.filter((folder) => folder.path.toLowerCase().startsWith(prefix))
			: []
	const matchingTags =
		mode.kind === "values" && mode.key === "tag"
			? tags.filter((entry) => entry.tag.toLowerCase().startsWith(prefix))
			: []

	return (
		<ScrollView
			contentContainerStyle={styles.listContent}
			contentInsetAdjustmentBehavior="automatic"
			keyboardDismissMode="on-drag"
			keyboardShouldPersistTaps="handled"
			style={{ backgroundColor: colors.groupedBackground }}
		>
			{mode.kind === "suggest" ? (
				<>
					<GroupedSectionHeader>Filters</GroupedSectionHeader>
					<GroupedList>
						{SEARCH_OPERATORS.map((operator) => {
							const selected = mode.operator === operator.key
							return (
								<Pressable
									accessibilityRole="button"
									android_ripple={{ color: colors.hover }}
									key={operator.key}
									onPress={() => onReplaceActiveWord(`${operator.key}:`)}
									style={[
										styles.operatorRow,
										{ backgroundColor: selected ? colors.accentSubtle : "transparent" },
									]}
								>
									<Text style={[styles.operatorCode, { color: colors.tint }]}>{operator.key}:</Text>
									<Text style={[styles.operatorLabel, { color: colors.secondaryLabel }]}>
										{operator.label}
									</Text>
								</Pressable>
							)
						})}
					</GroupedList>
					{recentQueries.length > 0 ? (
						<>
							<GroupedSectionHeader>Recent</GroupedSectionHeader>
							<GroupedList>
								{recentQueries.map((recent) => (
									<RecentQueryRow
										colors={colors}
										key={recent}
										onPress={() => onApplyQuery(parseQueryState(recent))}
										raw={recent}
									/>
								))}
							</GroupedList>
						</>
					) : null}
				</>
			) : null}
			{mode.kind === "values" && mode.key === "path" ? (
				<>
					<GroupedSectionHeader>Folders</GroupedSectionHeader>
					{matchingFolders.length > 0 ? (
						<GroupedList>
							{matchingFolders.map((folder) => (
								<GroupedRow
									key={folder.path}
									leading={
										<SymbolIcon
											color={colors.tint}
											name={{ md: "folder", sf: "folder" }}
											size={IS_IOS ? 20 : 24}
										/>
									}
									onPress={() => onReplaceActiveWord(`path:${folder.path} `)}
									title={folder.path}
									value={`${folder.noteCount} ${folder.noteCount === 1 ? "note" : "notes"}`}
								/>
							))}
						</GroupedList>
					) : (
						<EmptyState title="No folders match" />
					)}
				</>
			) : null}
			{mode.kind === "values" && mode.key === "tag" ? (
				<>
					<GroupedSectionHeader>Tags</GroupedSectionHeader>
					{matchingTags.length > 0 ? (
						<GroupedList>
							{matchingTags.map((entry) => (
								<GroupedRow
									key={entry.tag}
									leading={
										<SymbolIcon
											color={colors.tint}
											name={{ md: "tag", sf: "number" }}
											size={IS_IOS ? 20 : 24}
										/>
									}
									onPress={() => onReplaceActiveWord(`tag:${entry.tag} `)}
									title={`#${entry.tag}`}
									value={`${entry.filePaths.length} ${entry.filePaths.length === 1 ? "note" : "notes"}`}
								/>
							))}
						</GroupedList>
					) : (
						<EmptyState title="No tags match" />
					)}
				</>
			) : null}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	listContent: {
		paddingBottom: 32,
	},
	operatorCode: {
		fontFamily: Platform.select({ android: "monospace", ios: "Menlo" }),
		fontSize: 16,
		fontWeight: "600",
		lineHeight: 22,
		width: 60,
	},
	operatorLabel: {
		flex: 1,
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: 22,
	},
	operatorRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: IS_IOS ? 52 : 56,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	recentTokens: {
		flexDirection: "row",
		gap: 6,
	},
})
