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
import { MermaidDiagramExplorer } from "./MermaidDiagramExplorer"
import { closeMermaidModal, useMermaidModalTarget } from "./mermaidModalStore"
import { openMermaidDiagramTab } from "./mermaidWorkspace"

export function MermaidModalHost() {
	const target = useMermaidModalTarget()

	const handleOpenChange = (open: boolean) => {
		if (!open) closeMermaidModal()
	}

	const handleOpenInTab = () => {
		if (!target) return
		openMermaidDiagramTab(target)
		closeMermaidModal()
	}

	return (
		<Dialog open={target !== null} onOpenChange={handleOpenChange}>
			<DialogContent className="mermaid-modal-content flex h-[min(760px,calc(100vh-2rem))] flex-col gap-0 overflow-hidden p-0 md:max-w-[1120px] lg:max-w-[1240px]">
				<DialogHeader className="dialog-chrome-header shrink-0">
					<DialogTitle>{target?.title ?? "Mermaid diagram"}</DialogTitle>
				</DialogHeader>
				<DialogBody className="mermaid-modal-body">
					{target && <MermaidDiagramExplorer source={target.source} title={target.title} />}
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
