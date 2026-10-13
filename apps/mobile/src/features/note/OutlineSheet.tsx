import { getNoteTitle } from "@cortex/platform/utils"
import { type ReactNode, useState } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedList, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { SheetHeader } from "@/components/ui/SheetHeader"
import { toast } from "@/features/feedback/useToast"
import { dismissSheet, openNote } from "@/features/navigation/routes"
import { NoteOutlineList } from "@/features/note/NoteOutlineList"
import { useSheetFilePath } from "@/features/note/noteSheetParams"
import {
	listUnlinkedMentions,
	useNoteBacklinks,
	useNoteHeadings,
} from "@/features/note/useNoteOutline"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

type OutlineTab = "outline" | "backlinks"

const tabOptions: { label: string; value: OutlineTab }[] = [
	{ label: "Outline", value: "outline" },
	{ label: "Backlinks", value: "backlinks" },
]

const WIKI_LINK = /(\[\[[^\]]+\]\])/g

function LinkedContext({ context }: { context: string }) {
	const { colors } = useMobileColors()
	return (
		<Text numberOfLines={2} style={[styles.context, { color: colors.secondaryLabel }]}>
			{context.split(WIKI_LINK).map((part, index) =>
				part.startsWith("[[") ? (
					<Text key={index} style={{ color: colors.tint }}>
						{part}
					</Text>
				) : (
					part
				),
			)}
		</Text>
	)
}

function MentionRow({
	context,
	onPress,
	title,
	trailing,
}: {
	context: string
	onPress: () => void
	title: string
	trailing?: ReactNode
}) {
	const { colors } = useMobileColors()
	return (
		<Pressable
			accessibilityRole="button"
			android_ripple={{ color: colors.hover }}
			onPress={onPress}
			style={({ pressed }) => [
				styles.mention,
				{ backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" },
			]}
		>
			<View style={styles.mentionBody}>
				<Text numberOfLines={1} style={[styles.mentionTitle, { color: colors.label }]}>
					{title}
				</Text>
				<LinkedContext context={context} />
			</View>
			{trailing}
		</Pressable>
	)
}

function Backlinks({ filePath }: { filePath: string | null }) {
	const { colors } = useMobileColors()
	const backlinks = useNoteBacklinks(filePath)
	const unlinked = listUnlinkedMentions(filePath)
	const [showUnlinked, setShowUnlinked] = useState(false)

	return (
		<>
			<GroupedSectionHeader>
				{`${backlinks.length} linked ${backlinks.length === 1 ? "mention" : "mentions"}`}
			</GroupedSectionHeader>
			{backlinks.length === 0 ? (
				<EmptyState description="Notes that link here with [[…]] show up here." title="No backlinks" />
			) : (
				<GroupedList>
					{backlinks.map((backlink) => (
						<MentionRow
							context={backlink.context}
							key={backlink.sourcePath}
							onPress={() => {
								dismissSheet()
								openNote(backlink.sourcePath)
							}}
							title={backlink.title}
						/>
					))}
				</GroupedList>
			)}
			<GroupedSectionHeader>Unlinked mentions</GroupedSectionHeader>
			<GroupedList>
				{showUnlinked
					? unlinked.map((mention) => (
							<MentionRow
								context={mention.context}
								key={mention.sourcePath}
								onPress={() => toast(`Open ${mention.title} from Files`)}
								title={mention.title}
								trailing={
									<Pressable
										accessibilityLabel={`Link ${mention.title}`}
										accessibilityRole="button"
										onPress={() =>
											toast(`Linked ${mention.title} to ${filePath ? getNoteTitle(filePath) : "this note"}`)
										}
										style={[styles.linkButton, { backgroundColor: colors.accentSubtle }]}
									>
										<Text style={[styles.linkLabel, { color: colors.tint }]}>Link</Text>
									</Pressable>
								}
							/>
						))
					: [
							<Pressable
								accessibilityRole="button"
								disabled={unlinked.length === 0}
								key="show"
								onPress={() => setShowUnlinked(true)}
								style={styles.showMore}
							>
								<Text
									style={[
										styles.showMoreLabel,
										{ color: unlinked.length === 0 ? colors.secondaryLabel : colors.tint },
									]}
								>
									{unlinked.length === 0 ? "No unlinked mentions" : `Show ${unlinked.length} more`}
								</Text>
							</Pressable>,
						]}
			</GroupedList>
		</>
	)
}

export function OutlineSheet() {
	const { colors } = useMobileColors()
	const filePath = useSheetFilePath()
	const headings = useNoteHeadings(filePath)
	const [tab, setTab] = useState<OutlineTab>("backlinks")
	const title = filePath ? getNoteTitle(filePath) : "Note"

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<SheetHeader onClose={dismissSheet} title={title} />
			<SegmentedControl
				accessibilityLabel="Outline or backlinks"
				onChange={setTab}
				options={tabOptions}
				style={styles.segmented}
				value={tab}
			/>
			<ScrollView contentContainerStyle={styles.content}>
				{tab === "outline" ? (
					<View style={styles.outline}>
						<NoteOutlineList headings={headings} />
					</View>
				) : (
					<Backlinks filePath={filePath} />
				)}
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 40,
	},
	context: {
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: 20,
	},
	linkButton: {
		alignItems: "center",
		borderRadius: 999,
		height: 32,
		justifyContent: "center",
		paddingHorizontal: 14,
	},
	linkLabel: {
		fontSize: 15,
		fontWeight: "600",
		lineHeight: 20,
	},
	mention: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: 64,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	mentionBody: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	mentionTitle: {
		fontSize: IS_IOS ? 17 : 16,
		fontWeight: "600",
		lineHeight: 22,
	},
	outline: {
		paddingTop: 16,
	},
	root: {
		flex: 1,
	},
	segmented: {
		marginHorizontal: 16,
		marginBottom: 4,
	},
	showMore: {
		justifyContent: "center",
		minHeight: 48,
		paddingHorizontal: 16,
	},
	showMoreLabel: {
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: 22,
	},
})
