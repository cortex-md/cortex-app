import { useTagsStore } from "@cortex/core"
import { Platform, StyleSheet, Text, View } from "react-native"

import { StatusPill, statusToneFromLabel } from "@/components/ui/StatusPill"
import { useNoteExcerpt } from "@/features/search/noteExcerpts"
import type { QuickFinderItem } from "@/features/search/useQuickFinderResults"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

function formatDue(value: unknown): string | null {
	if (typeof value !== "string" || !value) return null
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return `Due ${value}`
	return `Due ${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
}

export function QuickFinderPreview({ item }: { item: QuickFinderItem }) {
	const { colors } = useMobileColors()
	const excerpt = useNoteExcerpt(item.filePath, item.modifiedAt)
	const fileTags = useTagsStore((state) => state.fileTags[item.filePath])
	const status = typeof excerpt?.meta.status === "string" ? excerpt.meta.status : null
	const due = IS_IOS ? formatDue(excerpt?.meta.due) : null
	const tags = fileTags ?? []

	return (
		<View
			accessibilityLabel="Preview"
			style={[styles.card, { backgroundColor: colors.cell }]}
		>
			<Text numberOfLines={1} style={[styles.folder, { color: colors.secondaryLabel }]}>
				{item.folder ? item.folder.split("/").join(" / ") : "Vault root"}
			</Text>
			<Text numberOfLines={2} style={[styles.title, { color: colors.label }]}>
				{item.title}
			</Text>
			{status || tags.length > 0 || due ? (
				<View style={styles.pills}>
					{status ? <StatusPill label={status} tone={statusToneFromLabel(status)} /> : null}
					{tags.map((tag, index) => (
						<View
							key={tag}
							style={[
								styles.tag,
								{ backgroundColor: index === 0 ? colors.tagActiveBackground : colors.tagBackground },
							]}
						>
							<Text
								style={[styles.tagText, { color: index === 0 ? colors.tagActiveText : colors.tagText }]}
							>
								#{tag}
							</Text>
						</View>
					))}
					{due ? <Text style={[styles.due, { color: colors.secondaryLabel }]}>{due}</Text> : null}
				</View>
			) : null}
			<Text numberOfLines={3} style={[styles.excerpt, { color: colors.secondaryLabel }]}>
				{excerpt === null ? "Loading preview…" : excerpt.excerpt || "Empty note"}
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	card: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		gap: 4,
		marginHorizontal: 16,
		marginTop: 12,
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	due: {
		alignSelf: "center",
		fontSize: 13,
		lineHeight: 18,
	},
	excerpt: {
		fontSize: 15,
		lineHeight: 20,
		marginTop: 4,
	},
	folder: {
		fontSize: 13,
		lineHeight: 18,
	},
	pills: {
		alignItems: "center",
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 6,
		marginVertical: 4,
	},
	tag: {
		borderRadius: 999,
		paddingHorizontal: 8,
		paddingVertical: 2,
	},
	tagText: {
		fontSize: 13,
		fontWeight: "500",
		lineHeight: 18,
	},
	title: {
		fontSize: 20,
		fontWeight: "700",
		lineHeight: 25,
	},
})
