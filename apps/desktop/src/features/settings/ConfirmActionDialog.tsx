import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@cortex/ui"
import { useState } from "react"

export interface ConfirmActionRequest {
	title: string
	description: string
	confirmLabel: string
	destructive?: boolean
	onConfirm: () => void | Promise<void>
}

export function useConfirmAction() {
	const [request, setRequest] = useState<ConfirmActionRequest | null>(null)
	const dialog = (
		<AlertDialog open={request !== null} onOpenChange={(open) => !open && setRequest(null)}>
			{request ? (
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>{request.title}</AlertDialogTitle>
						<AlertDialogDescription>{request.description}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
						<AlertDialogAction
							size="sm"
							variant={request.destructive ? "destructive" : "default"}
							onClick={() => void request.onConfirm()}
						>
							{request.confirmLabel}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			) : null}
		</AlertDialog>
	)
	return { confirm: setRequest, dialog }
}
