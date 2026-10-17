import { useRef, useState } from "react"
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput } from "react-native"

import { renameNote } from "@/features/note/noteRename"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

const IS_IOS = Platform.OS === "ios"

function TitleField({
	colors,
	filePath,
	onDone,
	title,
}: {
	colors: MobileColors
	filePath: string
	onDone: () => void
	title: string
}) {
	const [draft, setDraft] = useState(title)
	const committingRef = useRef(false)

	function commit() {
		if (committingRef.current) return
		committingRef.current = true
		void renameNote(filePath, draft).then((result) => {
			onDone()
			if ("error" in result) {
				Alert.alert("Couldn't rename note", result.error)
				return
			}
		})
	}

	return (
		<TextInput
			accessibilityLabel="Note title"
			autoCorrect={false}
			autoFocus
			multiline
			onBlur={commit}
			onChangeText={setDraft}
			onSubmitEditing={commit}
			placeholder="Untitled"
			placeholderTextColor={colors.tertiaryLabel}
			returnKeyType="done"
			selectionColor={colors.tint}
			style={[styles.title, styles.field, { color: colors.label }]}
			submitBehavior="blurAndSubmit"
			value={draft}
		/>
	)
}

export function NoteTitle({
	editable,
	editing,
	filePath,
	onEditingChange,
	title,
}: {
	editable: boolean
	editing: boolean
	filePath: string | null
	onEditingChange: (editing: boolean) => void
	title: string
}) {
	const { colors } = useMobileColors()
	if (editing && filePath) {
		return (
			<TitleField
				colors={colors}
				filePath={filePath}
				key={filePath}
				onDone={() => onEditingChange(false)}
				title={title}
			/>
		)
	}
	return (
		<Pressable
			accessibilityHint={editable ? "Renames the note" : undefined}
			accessibilityRole="header"
			disabled={!editable || !filePath}
			onPress={() => onEditingChange(true)}
		>
			<Text style={[styles.title, { color: colors.label }]}>{title}</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	field: {
		paddingBottom: 0,
		paddingTop: 0,
	},
	title: {
		fontSize: IS_IOS ? 28 : 26,
		fontWeight: "700",
		lineHeight: 34,
		marginBottom: 8,
		marginTop: 8,
		paddingHorizontal: 16,
	},
})
