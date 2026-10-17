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
import { createPortal } from "react-dom"
import { embedModal, useEmbedPortals } from "./embeds"

function EmbedPortals() {
	const portals = useEmbedPortals()
	return portals.map((portal) => createPortal(portal.node, portal.container, String(portal.id)))
}

function EmbedModal() {
	const target = embedModal.useTarget()

	const handleOpenChange = (open: boolean) => {
		if (!open) embedModal.close()
	}

	const handleOpenInTab = () => {
		if (!target) return
		target.openInTab()
		embedModal.close()
	}

	return (
		<Dialog open={target !== null} onOpenChange={handleOpenChange}>
			<DialogContent
				className={`${target?.kind ?? "drawing"}-modal-content flex h-[min(760px,calc(100vh-2rem))] flex-col gap-0 overflow-hidden p-0 md:max-w-[1120px] lg:max-w-[1240px]`}
			>
				<DialogHeader className="dialog-chrome-header shrink-0">
					<DialogTitle>{target?.title}</DialogTitle>
				</DialogHeader>
				<DialogBody className={`${target?.kind ?? "drawing"}-modal-body`}>
					{target?.body}
				</DialogBody>
				<DialogFooter className="dialog-chrome-footer shrink-0">
					<Button size="sm" type="button" variant="outline" onClick={handleOpenInTab}>
						<PanelTopOpenIcon className="size-4" aria-hidden="true" />
						Open in tab
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export function EmbedHost() {
	return (
		<>
			<EmbedModal />
			<EmbedPortals />
		</>
	)
}
