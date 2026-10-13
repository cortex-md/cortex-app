import { type SearchSnippet, splitSnippet } from "@cortex/search"
import { StyleSheet, Text, type TextStyle } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

export function SearchSnippetText({
	active = false,
	numberOfLines = 2,
	snippet,
	style,
}: {
	active?: boolean
	numberOfLines?: number
	snippet: SearchSnippet
	style?: TextStyle
}) {
	const { colors } = useMobileColors()
	const parts = splitSnippet(snippet)
	return (
		<Text numberOfLines={numberOfLines} style={[styles.text, { color: colors.secondaryLabel }, style]}>
			{parts.map((part, index) =>
				part.match ? (
					<Text
						key={index}
						style={[
							styles.mark,
							{
								backgroundColor: active ? colors.tintFill : colors.accentSubtle,
								color: active ? colors.onTint : colors.tint,
							},
						]}
					>
						{part.text}
					</Text>
				) : (
					<Text key={index}>{part.text}</Text>
				),
			)}
		</Text>
	)
}

export function HighlightedTitle({
	query,
	style,
	title,
}: {
	query: string
	style?: TextStyle
	title: string
}) {
	const { colors } = useMobileColors()
	const needle = query.trim().toLowerCase()
	const index = needle ? title.toLowerCase().indexOf(needle) : -1
	if (index < 0) {
		return (
			<Text numberOfLines={1} style={[styles.title, { color: colors.label }, style]}>
				{title}
			</Text>
		)
	}
	return (
		<Text numberOfLines={1} style={[styles.title, { color: colors.label }, style]}>
			{title.slice(0, index)}
			<Text style={[styles.mark, { backgroundColor: colors.accentSubtle, color: colors.tint }]}>
				{title.slice(index, index + needle.length)}
			</Text>
			{title.slice(index + needle.length)}
		</Text>
	)
}

const styles = StyleSheet.create({
	mark: {
		borderRadius: 3,
		fontWeight: "600",
	},
	text: {
		fontSize: 15,
		lineHeight: 20,
	},
	title: {
		fontSize: 17,
		lineHeight: 22,
	},
})
