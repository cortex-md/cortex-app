import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@cortex/ui"
import { usePluginStore } from "../pluginStore"
import { PluginViewRenderer } from "./PluginViewRenderer"

export function PluginModalHost() {
	const modalInstances = usePluginStore((state) => state.modalInstances)
	const views = usePluginStore((state) => state.views)
	const closeModal = usePluginStore((state) => state.closeModal)
	const updateModalState = usePluginStore((state) => state.updateModalState)

	return (
		<>
			{modalInstances.map((modal) => {
				const registration = views.find((view) => view.registrationKey === modal.viewKey)
				if (!registration) return null
				return (
					<Dialog
						key={modal.id}
						open
						onOpenChange={(open) => {
							if (!open) closeModal(modal.id)
						}}
					>
						<DialogContent className="max-w-xl p-0">
							<DialogHeader className="border-b border-border px-5 py-4">
								<DialogTitle>{modal.title ?? registration.label}</DialogTitle>
							</DialogHeader>
							<DialogBody className="max-h-[70vh] overflow-auto p-5">
								<PluginViewRenderer
									registration={registration}
									state={modal.state}
									onStateChange={(nextState) => updateModalState(modal.id, nextState)}
								/>
							</DialogBody>
						</DialogContent>
					</Dialog>
				)
			})}
		</>
	)
}
