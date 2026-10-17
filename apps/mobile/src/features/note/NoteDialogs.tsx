import { router } from "expo-router"

import { DeleteEntryDialog } from "@/features/files/DeleteEntryDialog"

export type NoteDialog = "none" | "delete"

export function NoteDialogs({
	dialog,
	filePath,
	onClose,
}: {
	dialog: NoteDialog
	filePath: string | null
	onClose: () => void
}) {
	return (
		<DeleteEntryDialog
			filePath={dialog === "delete" ? filePath : null}
			onDeleted={() => {
				if (router.canGoBack()) router.back()
			}}
			onDismiss={onClose}
		/>
	)
}
