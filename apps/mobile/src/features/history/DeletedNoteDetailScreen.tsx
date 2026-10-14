import { router, Stack, useLocalSearchParams } from "expo-router"
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { FloatingActionButton } from "@/components/ui/FloatingActionButton"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import MarkdownBlock from "@/components/ui/MarkdownBlock"
import { useMobileEditorThemeTokens } from "@/features/editor/editorTheme"
import { toast } from "@/features/feedback/useToast"
import {
	copyDeletedNoteText,
	deletedMomentLabel,
	findDeletedNote,
	restoreDeletedNote,
	useDeletedNoteBody,
} from "@/features/history/deletedNotesAdapter"
import { readParam } from "@/features/history/useVersionHistory"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function DeletedNoteDetailScreen() {
	const { colors } = useMobileColors()
	const themeTokens = useMobileEditorThemeTokens()
	const params = useLocalSearchParams<{ id?: string | string[] }>()
	const note = findDeletedNote(readParam(params.id))
	const body = useDeletedNoteBody(note)

	if (!note) {
		return (
			<View style={[styles.empty, { backgroundColor: colors.groupedBackground }]}>
				<Stack.Screen options={{ title: "Deleted note" }} />
				<EmptyState
					icon={{ sf: "trash", md: "delete" }}
					title="This note is no longer in the trash"
				/>
			</View>
		)
	}

	const handleCopy = () => {
		if (body === null) return
		void copyDeletedNoteText(body).then(() => toast("Copied the text"))
	}

	const handleRestore = () => {
		void restoreDeletedNote(note)
			.then(() => {
				toast(`Restored to ${note.folder}`)
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
						: () => (
								<HeaderIconButton
									accessibilityLabel="Copy text"
									icon={{ sf: "doc.on.doc", md: "content_copy" }}
									onPress={handleCopy}
								/>
							),
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="bottom">
					<Stack.Toolbar.Button icon="doc.on.doc" onPress={handleCopy}>
						Copy text
					</Stack.Toolbar.Button>
					<Stack.Toolbar.Spacer />
					<Stack.Toolbar.Button onPress={handleRestore} variant="prominent">
						Restore
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
			<ScrollView
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.groupedBackground }}
			>
				<Text style={[styles.meta, { color: colors.secondaryLabel }]}>
					{`Deleted ${deletedMomentLabel(note)} · ${note.folder}`}
				</Text>
				<View style={[styles.preview, { backgroundColor: colors.cell }]}>
					<MarkdownBlock
						content={body ?? "Loading…"}
						dom={{
							matchContents: true,
							scrollEnabled: false,
							style: styles.transparent,
							useExpoDOMWebView: false,
						}}
						themeTokens={themeTokens}
					/>
				</View>
			</ScrollView>
			{IS_IOS ? null : (
				<View style={styles.fab}>
					<FloatingActionButton
						icon={{ sf: "arrow.uturn.backward", md: "restore_page" }}
						label="Restore"
						onPress={handleRestore}
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
	meta: {
		fontSize: 13,
		lineHeight: 18,
		marginHorizontal: 20,
		marginTop: 4,
	},
	preview: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		marginHorizontal: 16,
		marginTop: 12,
		overflow: "hidden",
		padding: 12,
	},
	transparent: {
		backgroundColor: "transparent",
	},
})
