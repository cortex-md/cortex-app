import { getErrorMessage, useVaultStore, validateEntryName } from "@cortex/core"
import { useState } from "react"

import { TextPromptDialog } from "@/components/ui/TextPromptDialog"
import { toast } from "@/features/feedback/useToast"

export function duplicateFolderError(
	name: string,
	siblingNames: ReadonlySet<string>,
	locationLabel: string,
): string | null {
	const trimmed = name.trim()
	if (!trimmed) return null
	if (!siblingNames.has(trimmed.toLocaleLowerCase())) return null
	return `A folder named ${trimmed} already exists in ${locationLabel}.`
}

export function NewFolderDialog({
	locationLabel,
	onDismiss,
	parentPath,
	siblingNames,
	visible,
}: {
	locationLabel: string
	onDismiss: () => void
	parentPath: string
	siblingNames: ReadonlySet<string>
	visible: boolean
}) {
	const createFolder = useVaultStore((state) => state.createFolder)
	const [draft, setDraft] = useState("")
	const [submitError, setSubmitError] = useState<string | null>(null)
	const error =
		submitError ??
		duplicateFolderError(draft, siblingNames, locationLabel) ??
		(draft.trim() ? validateEntryName("folder", draft.trim()) : null)

	async function handleConfirm(value: string) {
		try {
			await createFolder(parentPath, value)
			toast(`Created ${value}`)
			onDismiss()
		} catch (createError) {
			setSubmitError(getErrorMessage(createError))
		}
	}

	if (!visible) return null

	return (
		<TextPromptDialog
			confirmLabel="Create"
			error={error}
			message={`${locationLabel} / ${draft.trim() || "Untitled folder"}`}
			onCancel={onDismiss}
			onChangeText={(value) => {
				setDraft(value)
				setSubmitError(null)
			}}
			onConfirm={(value) => void handleConfirm(value)}
			placeholder="Folder name"
			title="New folder"
			visible={visible}
		/>
	)
}
