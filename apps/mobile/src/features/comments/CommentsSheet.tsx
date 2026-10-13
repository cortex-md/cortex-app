import { getNoteTitle } from "@cortex/platform/utils"
import { ArrowUp, Check, RotateCcw, Send } from "lucide-react-native"
import { useState } from "react"
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native"

import { Avatar } from "@/components/ui/Avatar"
import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedFooter } from "@/components/ui/GroupedList"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { SheetHeader } from "@/components/ui/SheetHeader"
import { getCollabVaultName } from "@/features/collab/collabAdapter"
import type { CollabPerson } from "@/features/collab/collabFixtures"
import {
	type CommentThreadView,
	listMentionCandidates,
	replyToCommentThread,
	setCommentThreadResolved,
	splitCommentMentions,
	useNoteThreads,
} from "@/features/comments/commentsAdapter"
import { dismissSheet } from "@/features/navigation/routes"
import { NoteOutlineList } from "@/features/note/NoteOutlineList"
import { useSheetFilePath } from "@/features/note/noteSheetParams"
import { useNoteHeadings } from "@/features/note/useNoteOutline"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"
const MENTION_QUERY = /@([^@\s]*)$/

type CommentsTab = "comments" | "outline"

function threadStateLabel(thread: CommentThreadView): string {
	if (thread.resolved) return "Resolved"
	return thread.messages.length === 1 ? "1 comment" : `${thread.messages.length} comments`
}

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

function MentionPopover({
	candidates,
	onPick,
	vaultName,
}: {
	candidates: CollabPerson[]
	onPick: (person: CollabPerson) => void
	vaultName: string
}) {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.popover, { backgroundColor: colors.elevated, borderColor: colors.separator }]}>
			<Text style={[styles.popoverHeader, { color: colors.secondaryLabel }]}>
				{`Mention someone in ${vaultName}`}
			</Text>
			{candidates.length === 0 ? (
				<Text style={[styles.popoverEmpty, { color: colors.secondaryLabel }]}>No matches</Text>
			) : (
				candidates.map((person) => (
					<Pressable
						accessibilityRole="button"
						android_ripple={{ color: colors.hover }}
						key={person.id}
						onPress={() => onPick(person)}
						style={({ pressed }) => [
							styles.popoverRow,
							{ backgroundColor: pressed ? colors.hover : "transparent" },
						]}
					>
						<Avatar name={person.name} size={24} tint={person.tint} />
						<Text numberOfLines={1} style={[styles.popoverName, { color: colors.label }]}>
							{person.name}
						</Text>
						<Text style={[styles.popoverRole, { color: colors.secondaryLabel }]}>{person.role}</Text>
					</Pressable>
				))
			)}
		</View>
	)
}

function ReplyComposer({ filePath, threadId }: { filePath: string; threadId: string }) {
	const { colors } = useMobileColors()
	const [draft, setDraft] = useState("")
	const mentionMatch = MENTION_QUERY.exec(draft)
	const query = mentionMatch?.[1]?.toLocaleLowerCase() ?? null
	const candidates =
		query === null
			? []
			: listMentionCandidates().filter((person) => person.name.toLocaleLowerCase().includes(query))

	function pick(person: CollabPerson) {
		triggerSelectionHaptic()
		setDraft((current) => current.replace(MENTION_QUERY, `@${person.name} `))
	}

	function send() {
		const value = draft.trim()
		if (!value) return
		setDraft("")
		void replyToCommentThread(filePath, threadId, value)
	}

	return (
		<View style={styles.composer}>
			{query !== null ? (
				<MentionPopover candidates={candidates} onPick={pick} vaultName={getCollabVaultName()} />
			) : null}
			<View style={styles.replyRow}>
				<TextInput
					accessibilityLabel="Reply"
					multiline
					onChangeText={setDraft}
					placeholder="Reply, @ to mention"
					placeholderTextColor={colors.secondaryLabel}
					style={[styles.replyInput, { backgroundColor: colors.fill, color: colors.label }]}
					value={draft}
				/>
				<Pressable
					accessibilityLabel="Send reply"
					accessibilityRole="button"
					disabled={!draft.trim()}
					onPress={send}
					style={[
						styles.sendButton,
						IS_IOS ? { backgroundColor: colors.tintFill } : null,
						!draft.trim() ? styles.disabled : null,
					]}
				>
					{IS_IOS ? (
						<ArrowUp color={colors.onTint} size={20} strokeWidth={2.6} />
					) : (
						<Send color={colors.tint} size={22} strokeWidth={2.2} />
					)}
				</Pressable>
			</View>
		</View>
	)
}

function ThreadCard({
	filePath,
	focused,
	onFocus,
	thread,
}: {
	filePath: string
	focused: boolean
	onFocus: () => void
	thread: CommentThreadView
}) {
	const { colors } = useMobileColors()
	return (
		<Pressable
			onPress={onFocus}
			style={[
				styles.card,
				{
					backgroundColor: IS_IOS ? colors.cell : colors.elevated,
					borderColor: focused ? colors.accentBorder : "transparent",
				},
			]}
		>
			<View style={styles.cardHeader}>
				<Text style={[styles.cardState, { color: colors.secondaryLabel }]}>{threadStateLabel(thread)}</Text>
				<Pressable
					accessibilityRole="button"
					hitSlop={6}
					onPress={() => {
						triggerSelectionHaptic()
						void setCommentThreadResolved(filePath, thread.id, !thread.resolved)
					}}
					style={styles.resolveButton}
				>
					{thread.resolved ? (
						<RotateCcw color={colors.tint} size={16} strokeWidth={2.4} />
					) : (
						<Check color={colors.tint} size={16} strokeWidth={2.6} />
					)}
					<Text style={[styles.resolveLabel, { color: colors.tint }]}>
						{thread.resolved ? "Reopen" : "Resolve"}
					</Text>
				</Pressable>
			</View>
			<View style={[styles.quote, { borderLeftColor: colors.warning }]}>
				<Text numberOfLines={2} style={[styles.quoteText, { color: colors.secondaryLabel }]}>
					{thread.quote}
				</Text>
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
			{thread.resolved || !focused ? null : <ReplyComposer filePath={filePath} threadId={thread.id} />}
		</Pressable>
	)
}

export function CommentsSheet() {
	const { colors } = useMobileColors()
	const filePath = useSheetFilePath()
	const threads = useNoteThreads(filePath)
	const headings = useNoteHeadings(filePath)
	const [tab, setTab] = useState<CommentsTab>("comments")
	const firstOpenThreadId = threads.find((thread) => !thread.resolved)?.id ?? null
	const [focusedId, setFocusedId] = useState<string | null>(null)
	const activeFocusId = focusedId ?? firstOpenThreadId
	const openCount = threads.filter((thread) => !thread.resolved).length
	const title = filePath ? getNoteTitle(filePath) : "Note"
	const tabOptions: { label: string; value: CommentsTab }[] = [
		{ label: `Comments ${openCount}`, value: "comments" },
		{ label: "Outline", value: "outline" },
	]

	return (
		<KeyboardAvoidingView
			behavior={IS_IOS ? "padding" : undefined}
			style={[styles.root, { backgroundColor: colors.groupedBackground }]}
		>
			<SheetHeader onClose={dismissSheet} title={title} />
			<SegmentedControl
				accessibilityLabel="Comments or outline"
				onChange={setTab}
				options={tabOptions}
				style={styles.segmented}
				value={tab}
			/>
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardDismissMode="interactive"
				keyboardShouldPersistTaps="handled"
			>
				{tab === "outline" ? (
					<NoteOutlineList headings={headings} />
				) : threads.length === 0 || !filePath ? (
					<EmptyState
						description="Select text in the note and add a comment to start a thread."
						title="No comments yet"
					/>
				) : (
					threads.map((thread) => (
						<ThreadCard
							filePath={filePath}
							focused={thread.id === activeFocusId}
							key={thread.id}
							onFocus={() => setFocusedId(thread.id)}
							thread={thread}
						/>
					))
				)}
				{tab === "comments" ? (
					<GroupedFooter>
						{`Comments are stored next to the note, not inside it, so ${title}.md stays clean Markdown. Mentions are saved as @[[Diego Pires]].`}
					</GroupedFooter>
				) : null}
			</ScrollView>
		</KeyboardAvoidingView>
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
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
	},
	cardState: {
		fontSize: 13,
		fontWeight: "600",
		lineHeight: 18,
	},
	composer: {
		gap: 8,
	},
	content: {
		gap: 12,
		paddingBottom: 40,
		paddingTop: 12,
	},
	disabled: {
		opacity: 0.4,
	},
	mention: {
		fontWeight: "600",
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
	popover: {
		borderCurve: "continuous",
		borderRadius: 16,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
		paddingVertical: 6,
	},
	popoverEmpty: {
		fontSize: 15,
		lineHeight: 20,
		paddingHorizontal: 14,
		paddingVertical: 8,
	},
	popoverHeader: {
		fontSize: 12,
		fontWeight: "600",
		lineHeight: 16,
		paddingHorizontal: 14,
		paddingVertical: 6,
	},
	popoverName: {
		flex: 1,
		fontSize: 15,
		fontWeight: "500",
		lineHeight: 20,
	},
	popoverRole: {
		fontSize: 13,
		lineHeight: 18,
	},
	popoverRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 10,
		minHeight: 44,
		paddingHorizontal: 14,
	},
	quote: {
		borderLeftWidth: 3,
		paddingLeft: 10,
	},
	quoteText: {
		fontSize: 14,
		lineHeight: 20,
	},
	replyInput: {
		borderRadius: 20,
		flex: 1,
		fontSize: 15,
		lineHeight: 20,
		maxHeight: 120,
		minHeight: 40,
		paddingHorizontal: 14,
		paddingVertical: 10,
	},
	replyRow: {
		alignItems: "flex-end",
		flexDirection: "row",
		gap: 8,
	},
	resolveButton: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
	},
	resolveLabel: {
		fontSize: 15,
		fontWeight: "600",
		lineHeight: 20,
	},
	root: {
		flex: 1,
	},
	segmented: {
		marginHorizontal: 16,
	},
	sendButton: {
		alignItems: "center",
		borderRadius: 999,
		height: 40,
		justifyContent: "center",
		width: 40,
	},
})
