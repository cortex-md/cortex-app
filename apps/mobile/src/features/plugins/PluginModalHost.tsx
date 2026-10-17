import { usePluginStore } from "@cortex/plugin-host-core"
import { router } from "expo-router"
import { useEffect } from "react"

const presentedModals = new Set<string>()

export function PluginModalHost() {
	const modalIds = usePluginStore((state) =>
		state.modalInstances.map((modal) => modal.id).join("\n"),
	)

	useEffect(() => {
		const open = new Set(modalIds ? modalIds.split("\n") : [])
		for (const id of presentedModals) {
			if (!open.has(id)) presentedModals.delete(id)
		}
		for (const id of open) {
			if (presentedModals.has(id)) continue
			presentedModals.add(id)
			router.push({ params: { modalId: id }, pathname: "/plugin-modal" } as never)
		}
	}, [modalIds])

	return null
}
