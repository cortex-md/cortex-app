import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@cortex/ui"
import { PanelTopOpenIcon } from "lucide-react"
import { DrawingBoard } from "./DrawingBoard"
import { closeDrawingModal, useDrawingModalTarget } from "./drawingModalStore"
import { openDrawingBoardTab } from "./drawingWorkspace"

export function DrawingModalHost() {
	const target = useDrawingModalTarget()

	const handleOpenChange = (open: boolean) => {
		if (!open) closeDrawingModal()
	}

	const handleOpenInTab = () => {
		if (!target) return
		openDrawingBoardTab(target.filePath, target.drawingId)
		closeDrawingModal()
	}

	return (
		<Dialog open={target !== null} onOpenChange={handleOpenChange}>
			<DialogContent className="drawing-modal-content flex h-[min(760px,calc(100vh-2rem))] flex-col gap-0 overflow-hidden p-0 md:max-w-[1120px] lg:max-w-[1240px]">
				<DialogHeader className="dialog-chrome-header shrink-0">
					<DialogTitle>Drawing</DialogTitle>
				</DialogHeader>
				<DialogBody className="drawing-modal-body">
					{target && <DrawingBoard filePath={target.filePath} drawingId={target.drawingId} />}
				</DialogBody>
				<DialogFooter className="dialog-chrome-footer shrink-0">
					<Button type="button" variant="outline" onClick={handleOpenInTab}>
						<PanelTopOpenIcon className="size-4" aria-hidden="true" />
						Open in tab
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
