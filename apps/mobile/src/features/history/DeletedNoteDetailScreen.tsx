import { router, Stack, useLocalSearchParams } from "expo-router"
import { ArchiveRestore, Copy } from "lucide-react-native"
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native"

import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { FloatingActionButton } from "@/components/ui/FloatingActionButton"
import { GroupedFooter } from "@/components/ui/GroupedList"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import MarkdownBlock from "@/components/ui/MarkdownBlock"
import { useMobileEditorThemeTokens } from "@/features/editor/editorTheme"
import { toast } from "@/features/feedback/useToast"
import {
	copyDeletedNoteText,
	deletedMomentLabel,
	findDeletedNote,
	restoreDeletedNote,
	retentionLabel,
} from "@/features/history/deletedNotesAdapter"
import { readParam } from "@/features/history/useVersionHistory"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function DeletedNoteDetailScreen() {
	const { colors } = useMobileColors()
	const themeTokens = useMobileEditorThemeTokens()
	const params = useLocalSearchParams<{ id?: string | string[] }>()
	const note = findDeletedNote(readParam(params.id))

	if (!note) {
		return (
			<View style={[styles.empty, { backgroundColor: colors.groupedBackground }]}>
				<Stack.Screen options={{ title: "" }} />
				<EmptyState title="No deleted notes" />
			</View>
		)
	}

	const subtitle = IS_IOS
		? `Deleted ${deletedMomentLabel(note)} by ${note.who} · ${note.device}`
		: `Deleted ${deletedMomentLabel(note)} by ${note.who}`

	const handleCopy = () => {
		void copyDeletedNoteText(note).then(() => toast(`Copied the text of ${note.title}`))
	}

	const handleRestore = () => {
		void restoreDeletedNote(note)
			.then(() => {
				toast(`${note.title} restored to ${note.folder}`)
				if (router.canGoBack()) router.back()
			})
			.catch((error: unknown) => toast(error instanceof Error ? error.message : String(error)))
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: note.title,
					headerRight: IS_IOS
						? undefined
						: () => <HeaderIconButton accessibilityLabel="Copy text" Icon={Copy} onPress={handleCopy} />,
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="bottom">
					<Stack.Toolbar.Button icon="doc.on.doc" onPress={handleCopy}>
						Copy text
					</Stack.Toolbar.Button>
					<Stack.Toolbar.Spacer />
					<Stack.Toolbar.Button onPress={handleRestore} variant="prominent">
						Restore note
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
			<ScrollView
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.groupedBackground }}
			>
				<View style={styles.head}>
					<Text style={[styles.subtitle, { color: colors.secondaryLabel }]}>{subtitle}</Text>
					<Badge label={retentionLabel(note)} tint={!note.expiresSoon} />
				</View>
				<View style={[styles.preview, { backgroundColor: colors.cell }]}>
					<MarkdownBlock
						content={note.body}
						dom={{
							matchContents: true,
							scrollEnabled: false,
							style: styles.transparent,
							useExpoDOMWebView: false,
						}}
						themeTokens={themeTokens}
					/>
				</View>
				<GroupedFooter>{`Restores to ${note.folder}`}</GroupedFooter>
			</ScrollView>
			{IS_IOS ? null : (
				<View style={styles.fab}>
					<FloatingActionButton
						Icon={ArchiveRestore}
						label="Restore note"
						onPress={handleRestore}
						sf="arrow.uturn.backward"
					/>
				</View>
			)}
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 120,
	},
	empty: {
		flex: 1,
	},
	fab: {
		bottom: 24,
		position: "absolute",
		right: 16,
	},
	head: {
		alignItems: "flex-start",
		gap: 8,
		marginHorizontal: 20,
		marginTop: 8,
	},
	preview: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 20 : 16,
		marginHorizontal: 16,
		marginTop: 16,
		overflow: "hidden",
		padding: 12,
	},
	subtitle: {
		fontSize: 13,
		lineHeight: 18,
	},
	transparent: {
		backgroundColor: "transparent",
	},
})
