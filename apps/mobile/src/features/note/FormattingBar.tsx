import type { MarkdownToolbarCommandId } from "@cortex/editor/markdown-format-commands"
import {
	Bold,
	Heading1,
	Italic,
	Keyboard,
	Link,
	List,
	ListTodo,
	type LucideIcon,
	Slash,
	TextQuote,
} from "lucide-react-native"
import { Fragment } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native"

import { workspaceChannel } from "@/features/workspace/workspaceChannel"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"

interface FormattingButton {
	commandId: MarkdownToolbarCommandId | "mobile.slash"
	label: string
	Icon: LucideIcon
}

const formattingGroups: FormattingButton[][] = [
	[
		{ commandId: "format.heading-1", label: "Heading 1", Icon: Heading1 },
		{ commandId: "format.bold", label: "Bold", Icon: Bold },
		{ commandId: "format.italic", label: "Italic", Icon: Italic },
		{ commandId: "format.link", label: "Insert link", Icon: Link },
	],
	[
		{ commandId: "format.task-list", label: "Task list", Icon: ListTodo },
		{ commandId: "format.unordered-list", label: "Unordered list", Icon: List },
		{ commandId: "format.blockquote", label: "Blockquote", Icon: TextQuote },
		{ commandId: "mobile.slash", label: "Slash commands", Icon: Slash },
	],
]

export const FORMATTING_BAR_HEIGHT = 48

export function FormattingBar() {
	const { colors } = useMobileColors()

	function run(commandId: string) {
		triggerSelectionHaptic()
		workspaceChannel.sendCommand(commandId)
	}

	return (
		<View
			style={[
				styles.bar,
				{ backgroundColor: colors.secondaryBackground, borderTopColor: colors.separator },
			]}
		>
			<ScrollView
				contentContainerStyle={styles.content}
				horizontal
				keyboardShouldPersistTaps="always"
				showsHorizontalScrollIndicator={false}
			>
				{formattingGroups.map((group, index) => (
					<Fragment key={group[0]?.commandId ?? "group"}>
						{index > 0 ? (
							<View style={[styles.divider, { backgroundColor: colors.separator }]} />
						) : null}
						{group.map((button) => (
							<Pressable
								accessibilityLabel={button.label}
								accessibilityRole="button"
								key={button.commandId}
								onPress={() => run(button.commandId)}
								style={({ pressed }) => [
									styles.button,
									{ backgroundColor: pressed ? colors.accentSubtle : "transparent" },
								]}
							>
								<button.Icon color={colors.label} size={20} strokeWidth={2.1} />
							</Pressable>
						))}
					</Fragment>
				))}
			</ScrollView>
			{IS_IOS ? (
				<Pressable
					accessibilityLabel="Hide keyboard"
					accessibilityRole="button"
					onPress={() => run("mobile.blur")}
					style={({ pressed }) => [
						styles.button,
						{ backgroundColor: pressed ? colors.accentSubtle : "transparent" },
					]}
				>
					<Keyboard color={colors.label} size={20} strokeWidth={2.1} />
				</Pressable>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	bar: {
		alignItems: "center",
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		height: FORMATTING_BAR_HEIGHT,
		paddingHorizontal: 4,
	},
	button: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 10,
		height: 44,
		justifyContent: "center",
		width: 44,
	},
	content: {
		alignItems: "center",
		gap: 2,
	},
	divider: {
		height: 24,
		marginHorizontal: 6,
		width: StyleSheet.hairlineWidth,
	},
})
