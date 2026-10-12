import { useCanReadVaultPath } from "@cortex/core"
import { FileWarningIcon, LockIcon } from "lucide-react"

interface NoteUnavailableProps {
	filePath: string
	message: string
}

export function NoteUnavailable({ filePath, message }: NoteUnavailableProps) {
	const canRead = useCanReadVaultPath(filePath)
	const Icon = canRead ? FileWarningIcon : LockIcon
	return (
		<div className="note-unavailable" role="alert">
			<Icon className="note-unavailable-icon" />
			<p className="note-unavailable-title">
				{canRead ? "This note couldn't be opened" : "You don't have access to this note"}
			</p>
			<p className="note-unavailable-description">
				{canRead
					? message
					: "It belongs to a folder restricted to other members, so it isn't synced to this device. Ask a vault admin for access."}
			</p>
		</div>
	)
}
