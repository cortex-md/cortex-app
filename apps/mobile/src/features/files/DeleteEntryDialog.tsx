import { getErrorMessage, useVaultStore } from "@cortex/core"
import { getBaseName, stripMarkdownExtension } from "@cortex/platform/utils"

import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { toast } from "@/features/feedback/useToast"
import { triggerDeleteHaptic } from "@/utils/haptics"

export const DELETE_ENTRY_MESSAGE =
	"The file is moved to the trash on this device. Synced devices remove it on their next sync and keep a copy in Deleted notes for 30 days."

export function DeleteEntryDialog({
	filePath,
	isDirectory = false,
	onDeleted,
	onDismiss,
}: {
	filePath: string | null
	isDirectory?: boolean
	onDeleted?: () => void
	onDismiss: () => void
}) {
	const deleteFile = useVaultStore((state) => state.deleteFile)
	const name = filePath ? stripMarkdownExtension(getBaseName(filePath)) : ""

	async function handleConfirm() {
		if (!filePath) return
		triggerDeleteHaptic()
		try {
			await deleteFile(filePath)
			onDismiss()
			onDeleted?.()
			toast(`Moved "${name}" to trash`)
		} catch (error) {
			toast(getErrorMessage(error))
		}
	}

	return (
		<ConfirmDialog
			confirmLabel="Move to trash"
			destructive
			message={
				isDirectory
					? "The folder and everything inside it move to the trash on this device. Synced devices remove them on their next sync."
					: DELETE_ENTRY_MESSAGE
			}
			onCancel={onDismiss}
			onConfirm={() => void handleConfirm()}
			title={`Move "${name}" to trash?`}
			visible={filePath !== null}
		/>
	)
}
