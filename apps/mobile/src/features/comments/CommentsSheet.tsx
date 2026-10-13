import { Stack } from "expo-router"
import { useState } from "react"
import {
	FlatList,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native"

import { Avatar } from "@/components/ui/Avatar"
import { EmptyState } from "@/components/ui/EmptyState"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import { SymbolIcon } from "@/components/ui/Symbol"
import type { CollabPerson } from "@/features/collab/collabFixtures"
import {
	type CommentThreadView,
	listMentionCandidates,
	replyToCommentThread,
	setCommentThreadResolved,
	splitCommentMentions,
	useNoteThreads,
} from "@/features/comments/commentsAdapter"
import { SendButton } from "@/features/comments/SendButton"
import { dismissSheet } from "@/features/navigation/routes"
import { useSheetFilePath } from "@/features/note/noteSheetParams"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"
const MENTION_QUERY = /@([^@\s]*)$/

function CommentBody({ body }: { body: string }) {
	const { colors } = useMobileColors()
	return (
		<Text style={[styles.body, { color: colors.label }]}>
			{splitCommentMentions(body).map((segment, index) =>
				segment.mention ? (
					<Text key={index} style={[styles.mention, { color: colors.tint }]}>
						{segment.text}
					</Text>
				) : (
					segment.text
				),
			)}
		</Text>
	)
}

function MentionList({
	candidates,
	onPick,
}: {
	candidates: CollabPerson[]
	onPick: (person: CollabPerson) => void
}) {
	const { colors } = useMobileColors()
	if (candidates.length === 0) return null
	return (
		<View
			style={[styles.mentions, { backgroundColor: colors.elevated, borderColor: colors.separator }]}
		>
			{candidates.map((person) => (
				<Pressable
					accessibilityRole="button"
					android_ripple={{ color: colors.hover }}
					key={person.id}
					onPress={() => onPick(person)}
					style={({ pressed }) => [
						styles.mentionRow,
						{ backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" },
					]}
				>
					<Avatar name={person.name} size={24} tint={person.tint} />
					<Text numberOfLines={1} style={[styles.mentionName, { color: colors.label }]}>
						{person.name}
					</Text>
				</Pressable>
			))}
		</View>
	)
}

function Composer({ filePath, thread }: { filePath: string; thread: CommentThreadView }) {
	const { colors } = useMobileColors()
	const [draft, setDraft] = useState("")
	const mentionMatch = MENTION_QUERY.exec(draft)
	const query = mentionMatch?.[1]?.toLocaleLowerCase() ?? null
	const candidates =
		query === null
			? []
			: listMentionCandidates().filter((person) => person.name.toLocaleLowerCase().includes(query))

	const pick = (person: CollabPerson) => {
		triggerSelectionHaptic()
		setDraft((current) => current.replace(MENTION_QUERY, `@${person.name} `))
	}

	const send = () => {
		const value = draft.trim()
		if (!value) return
		setDraft("")
		void replyToCommentThread(filePath, thread.id, value)
	}

	return (
		<View style={[styles.composer, { borderTopColor: colors.separator }]}>
			<MentionList candidates={candidates} onPick={pick} />
			<View style={styles.composerRow}>
				<TextInput
					accessibilityLabel="Reply"
					multiline
					onChangeText={setDraft}
					placeholder="Reply, @ to mention"
					placeholderTextColor={colors.placeholder}
					style={[styles.input, { backgroundColor: colors.fill, color: colors.label }]}
					value={draft}
				/>
				<SendButton disabled={!draft.trim()} onPress={send} />
			</View>
		</View>
	)
}

function ThreadCard({
	filePath,
	onSelect,
	selected,
	thread,
}: {
	filePath: string
	onSelect: () => void
	selected: boolean
	thread: CommentThreadView
}) {
	const { colors } = useMobileColors()
	return (
		<Pressable
			onPress={onSelect}
			style={[
				styles.card,
				{
					backgroundColor: colors.cell,
					borderColor: selected ? colors.accentBorder : "transparent",
					opacity: thread.resolved ? 0.6 : 1,
				},
			]}
		>
			<View style={styles.cardHeader}>
				<View style={[styles.quote, { borderLeftColor: colors.warning }]}>
					<Text numberOfLines={2} style={[styles.quoteText, { color: colors.secondaryLabel }]}>
						{thread.quote}
					</Text>
				</View>
				<Pressable
					accessibilityLabel={thread.resolved ? "Reopen thread" : "Resolve thread"}
					accessibilityRole="button"
					hitSlop={8}
					onPress={() => {
						triggerSelectionHaptic()
						void setCommentThreadResolved(filePath, thread.id, !thread.resolved)
					}}
				>
					<SymbolIcon
						color={colors.tint}
						name={
							thread.resolved
								? { sf: "arrow.uturn.backward.circle", md: "undo" }
								: { sf: "checkmark.circle", md: "check_circle" }
						}
						size={24}
					/>
				</Pressable>
			</View>
			{thread.messages.map((message) => (
				<View key={message.id} style={styles.message}>
					<Avatar name={message.authorName} size={26} tint={message.authorTint} />
					<View style={styles.messageBody}>
						<Text style={[styles.meta, { color: colors.secondaryLabel }]}>
							<Text style={[styles.author, { color: colors.label }]}>{message.authorName}</Text>
							{`  ${message.timeLabel}`}
						</Text>
						<CommentBody body={message.body} />
					</View>
				</View>
			))}
		</Pressable>
	)
}

export function CommentsSheet() {
	const { colors } = useMobileColors()
	const filePath = useSheetFilePath()
	const threads = useNoteThreads(filePath)
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const selected =
		threads.find((thread) => thread.id === selectedId && !thread.resolved) ??
		threads.find((thread) => !thread.resolved) ??
		null

	return (
		<>
			<Stack.Screen
				options={{
					title: "Comments",
					headerRight: IS_IOS
						? undefined
						: () => (
								<HeaderIconButton
									accessibilityLabel="Close"
									icon={{ sf: "xmark", md: "close" }}
									onPress={dismissSheet}
								/>
							),
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button onPress={dismissSheet} variant="done">
						Done
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
			<KeyboardAvoidingView
				behavior={IS_IOS ? "padding" : undefined}
				style={[styles.root, { backgroundColor: colors.groupedBackground }]}
			>
				<FlatList
					contentContainerStyle={styles.content}
					contentInsetAdjustmentBehavior="automatic"
					data={filePath ? threads : []}
					keyboardDismissMode="interactive"
					keyboardShouldPersistTaps="handled"
					keyExtractor={(thread) => thread.id}
					ListEmptyComponent={
						<EmptyState
							description="Select text in the note and add a comment to start a thread."
							icon={{ sf: "text.bubble", md: "comment" }}
							title="No comments yet"
						/>
					}
					renderItem={({ item }) =>
						filePath ? (
							<ThreadCard
								filePath={filePath}
								onSelect={() => setSelectedId(item.id)}
								selected={item.id === selected?.id}
								thread={item}
							/>
						) : null
					}
				/>
				{filePath && selected ? (
					<Composer filePath={filePath} key={selected.id} thread={selected} />
				) : null}
			</KeyboardAvoidingView>
		</>
	)
}

const styles = StyleSheet.create({
	author: {
		fontWeight: "600",
	},
	body: {
		fontSize: 15,
		lineHeight: 20,
	},
	card: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		borderWidth: 2,
		gap: 12,
		marginHorizontal: 16,
		padding: 16,
	},
	cardHeader: {
		alignItems: "flex-start",
		flexDirection: "row",
		gap: 12,
	},
	composer: {
		borderTopWidth: StyleSheet.hairlineWidth,
		gap: 8,
		paddingBottom: 12,
		paddingHorizontal: 16,
		paddingTop: 8,
	},
	composerRow: {
		alignItems: "flex-end",
		flexDirection: "row",
		gap: 8,
	},
	content: {
		gap: 12,
		paddingBottom: 24,
		paddingTop: 8,
	},
	input: {
		borderRadius: 20,
		flex: 1,
		fontSize: 16,
		lineHeight: 20,
		maxHeight: 120,
		minHeight: 40,
		paddingHorizontal: 14,
		paddingVertical: 10,
	},
	mention: {
		fontWeight: "600",
	},
	mentionName: {
		flex: 1,
		fontSize: 15,
		lineHeight: 20,
	},
	mentionRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 10,
		minHeight: 44,
		paddingHorizontal: 14,
	},
	mentions: {
		borderCurve: "continuous",
		borderRadius: 16,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
		paddingVertical: 4,
	},
	message: {
		flexDirection: "row",
		gap: 10,
	},
	messageBody: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	meta: {
		fontSize: 13,
		lineHeight: 18,
	},
	quote: {
		borderLeftWidth: 3,
		flex: 1,
		paddingLeft: 10,
	},
	quoteText: {
		fontSize: 14,
		lineHeight: 20,
	},
	root: {
		flex: 1,
	},
})
