import { Fragment } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { Symbol } from "@/components/ui/Symbol"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

const IS_IOS = Platform.OS === "ios"
const TASK_PATTERN = /^(\s*)[-*+]\s+\[( |x|X)\]\s?(.*)$/u
const BULLET_PATTERN = /^(\s*)[-*+]\s+(.*)$/u
const ORDERED_PATTERN = /^(\s*)(\d+)[.)]\s+(.*)$/u
const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/u
const INLINE_PATTERN = /(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|`[^`]+`)/u

export type RowBodyBlock =
	| { kind: "heading"; level: number; text: string }
	| { kind: "task"; checked: boolean; depth: number; index: number; text: string }
	| { kind: "bullet"; depth: number; marker: string; text: string }
	| { kind: "quote"; text: string }
	| { kind: "code"; text: string }
	| { kind: "paragraph"; text: string }
	| { kind: "space" }

export function parseRowBody(body: string, title: string): RowBodyBlock[] {
	const blocks: RowBodyBlock[] = []
	let taskIndex = 0
	let code: string[] | null = null
	for (const line of body.split("\n")) {
		if (line.trimStart().startsWith("```")) {
			if (code) {
				blocks.push({ kind: "code", text: code.join("\n") })
				code = null
			} else {
				code = []
			}
			continue
		}
		if (code) {
			code.push(line)
			continue
		}
		const task = TASK_PATTERN.exec(line)
		if (task) {
			blocks.push({
				checked: task[2] !== " ",
				depth: Math.floor(task[1].length / 2),
				index: taskIndex++,
				kind: "task",
				text: task[3],
			})
			continue
		}
		const heading = HEADING_PATTERN.exec(line)
		if (heading) {
			if (blocks.length === 0 && heading[1].length === 1 && heading[2].trim() === title) continue
			blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] })
			continue
		}
		const ordered = ORDERED_PATTERN.exec(line)
		if (ordered) {
			blocks.push({
				depth: Math.floor(ordered[1].length / 2),
				kind: "bullet",
				marker: `${ordered[2]}.`,
				text: ordered[3],
			})
			continue
		}
		const bullet = BULLET_PATTERN.exec(line)
		if (bullet) {
			blocks.push({
				depth: Math.floor(bullet[1].length / 2),
				kind: "bullet",
				marker: "•",
				text: bullet[2],
			})
			continue
		}
		if (line.startsWith(">")) {
			blocks.push({ kind: "quote", text: line.replace(/^>\s?/u, "") })
			continue
		}
		if (!line.trim()) {
			if (blocks.length > 0 && blocks.at(-1)?.kind !== "space") blocks.push({ kind: "space" })
			continue
		}
		blocks.push({ kind: "paragraph", text: line })
	}
	if (code) blocks.push({ kind: "code", text: code.join("\n") })
	while (blocks.at(-1)?.kind === "space") blocks.pop()
	return blocks
}

function InlineText({ colors, text }: { colors: MobileColors; text: string }) {
	const parts = text.split(INLINE_PATTERN).filter(Boolean)
	return (
		<>
			{parts.map((part, index) => {
				if (part.startsWith("[[") && part.endsWith("]]")) {
					return (
						<Text key={index} style={{ color: colors.tint }}>
							{part}
						</Text>
					)
				}
				if (part.startsWith("**") && part.endsWith("**")) {
					return (
						<Text key={index} style={styles.bold}>
							{part.slice(2, -2)}
						</Text>
					)
				}
				if (part.startsWith("`") && part.endsWith("`")) {
					return (
						<Text
							key={index}
							style={[styles.inlineCode, { backgroundColor: colors.codeBackground }]}
						>
							{part.slice(1, -1)}
						</Text>
					)
				}
				return <Fragment key={index}>{part}</Fragment>
			})}
		</>
	)
}

export function RowNoteBody({
	blocks,
	onToggleTask,
}: {
	blocks: RowBodyBlock[]
	onToggleTask: (index: number) => void
}) {
	const { colors } = useMobileColors()
	return (
		<View>
			{blocks.map((block, index) => {
				switch (block.kind) {
					case "space":
						return <View key={index} style={styles.space} />
					case "heading":
						return (
							<Text
								accessibilityRole="header"
								key={index}
								style={[block.level <= 2 ? styles.h2 : styles.h3, { color: colors.label }]}
							>
								<InlineText colors={colors} text={block.text} />
							</Text>
						)
					case "task":
						return (
							<View key={index} style={[styles.listRow, { paddingLeft: block.depth * 20 }]}>
								<Pressable
									accessibilityLabel="Toggle task"
									accessibilityRole="checkbox"
									accessibilityState={{ checked: block.checked }}
									hitSlop={8}
									onPress={() => onToggleTask(block.index)}
									style={[
										styles.checkbox,
										block.checked
											? { backgroundColor: colors.tintFill, borderColor: colors.tintFill }
											: { borderColor: colors.tertiaryLabel },
									]}
								>
									{block.checked ? (
										<Symbol
											color={colors.onTint}
											name={{ md: "check", sf: "checkmark" }}
											size={13}
										/>
									) : null}
								</Pressable>
								<Text
									style={[
										styles.paragraph,
										styles.flex,
										block.checked
											? { color: colors.tertiaryLabel, textDecorationLine: "line-through" }
											: { color: colors.label },
									]}
								>
									<InlineText colors={colors} text={block.text} />
								</Text>
							</View>
						)
					case "bullet":
						return (
							<View key={index} style={[styles.listRow, { paddingLeft: block.depth * 20 }]}>
								<Text style={[styles.paragraph, styles.marker, { color: colors.secondaryLabel }]}>
									{block.marker}
								</Text>
								<Text style={[styles.paragraph, styles.flex, { color: colors.label }]}>
									<InlineText colors={colors} text={block.text} />
								</Text>
							</View>
						)
					case "quote":
						return (
							<Text
								key={index}
								style={[
									styles.paragraph,
									styles.quote,
									{ borderLeftColor: colors.border, color: colors.secondaryLabel },
								]}
							>
								<InlineText colors={colors} text={block.text} />
							</Text>
						)
					case "code":
						return (
							<Text
								key={index}
								style={[
									styles.code,
									{ backgroundColor: colors.codeBackground, color: colors.label },
								]}
							>
								{block.text}
							</Text>
						)
					default:
						return (
							<Text key={index} style={[styles.paragraph, { color: colors.label }]}>
								<InlineText colors={colors} text={block.text} />
							</Text>
						)
				}
			})}
		</View>
	)
}

const MONO = IS_IOS ? "Menlo" : "monospace"

const styles = StyleSheet.create({
	bold: {
		fontWeight: "700",
	},
	checkbox: {
		alignItems: "center",
		borderRadius: 999,
		borderWidth: 2,
		height: 24,
		justifyContent: "center",
		marginTop: 1,
		width: 24,
	},
	code: {
		borderRadius: 10,
		fontFamily: MONO,
		fontSize: 14,
		lineHeight: 22,
		marginVertical: 6,
		overflow: "hidden",
		padding: 12,
	},
	flex: {
		flex: 1,
	},
	h2: {
		fontSize: 22,
		fontWeight: "700",
		lineHeight: 28,
		marginBottom: 6,
		marginTop: 18,
	},
	h3: {
		fontSize: 18,
		fontWeight: "600",
		lineHeight: 24,
		marginBottom: 4,
		marginTop: 14,
	},
	inlineCode: {
		fontFamily: MONO,
		fontSize: 14,
	},
	listRow: {
		alignItems: "flex-start",
		flexDirection: "row",
		gap: 10,
		marginVertical: 4,
	},
	marker: {
		minWidth: 14,
	},
	paragraph: {
		fontSize: 17,
		lineHeight: 26,
	},
	quote: {
		borderLeftWidth: 3,
		marginVertical: 4,
		paddingLeft: 12,
	},
	space: {
		height: 10,
	},
})
