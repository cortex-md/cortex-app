import { type EntryNameKind, getEntryNameKind, validateEntryName } from "@cortex/core"
import { Button as ExpoButton } from "@expo/ui"
import { useRef, useState } from "react"

import { ActionSheet } from "@/components/ui/ActionSheet"
import { MobileTextField } from "@/components/ui/MobileTextField"
import type { TextSheetAction } from "@/features/sidebar/sidebarUiState"

export function getTextActionNameKind(action: TextSheetAction): EntryNameKind {
	if (action?.kind === "rename") return getEntryNameKind(action.entry)
	return action?.kind === "create-folder" ? "folder" : "note"
}

function getTextActionTitle(action: TextSheetAction): string {
	switch (action?.kind) {
		case "create-note":
			return "New note"
		case "create-folder":
			return "New folder"
		case "rename":
			return action.entry.isDir ? "Rename folder" : "Rename note"
		default:
			return ""
	}
}

function getTextActionPlaceholder(action: TextSheetAction): string {
	switch (action?.kind) {
		case "create-note":
			return "Untitled"
		case "create-folder":
			return "Research"
		case "rename":
			return action.entry.isDir ? "Folder name" : "Note title"
		default:
			return ""
	}
}

export function TextActionSheet({
	action,
	error,
	initialValue,
	onDismiss,
	onSubmit,
	submitting,
}: {
	action: TextSheetAction
	error: string | null
	initialValue: string
	onDismiss: () => void
	onSubmit: (value: string) => void
	submitting: boolean
}) {
	const draftRef = useRef(initialValue)
	const [validationError, setValidationError] = useState<string | null>(null)
	const title = getTextActionTitle(action)

	function handleSubmit() {
		const value = draftRef.current.trim()
		const nextValidationError = validateEntryName(getTextActionNameKind(action), value)
		if (nextValidationError) {
			setValidationError(nextValidationError)
			return
		}
		onSubmit(value)
	}

	return (
		<ActionSheet
			isPresented={action !== null}
			onDismiss={onDismiss}
			sectionTitle={title}
			spacing={12}
			supportingText={validationError ?? error ?? "Saved inside this vault."}
			title={title}
		>
			<MobileTextField
				autoCapitalize="sentences"
				autoCorrect={false}
				autoFocus
				defaultValue={initialValue}
				error={validationError ?? error}
				onChangeText={(value) => {
					draftRef.current = value
					setValidationError(null)
				}}
				onSubmitText={(value) => {
					draftRef.current = value
					handleSubmit()
				}}
				placeholder={getTextActionPlaceholder(action)}
				returnKeyType="done"
			/>
			<ExpoButton
				disabled={submitting}
				label={submitting ? "Working..." : "Done"}
				onPress={handleSubmit}
			/>
		</ActionSheet>
	)
}
