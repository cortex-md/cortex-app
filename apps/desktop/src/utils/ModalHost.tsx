import { Dialog } from "@cortex/ui"
import type { ReactNode } from "react"
import type { ModalStore } from "./createModalStore"

interface ModalHostProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	children: ReactNode
}

export function ModalHost({ open, onOpenChange, children }: ModalHostProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{open && children}
		</Dialog>
	)
}

interface ModalStoreHostProps<T> {
	store: ModalStore<T>
	children: (target: T) => ReactNode
}

export function ModalStoreHost<T>({ store, children }: ModalStoreHostProps<T>) {
	const target = store.useTarget()
	const handleOpenChange = (open: boolean) => {
		if (!open) store.close()
	}
	return (
		<ModalHost open={target !== null} onOpenChange={handleOpenChange}>
			{target !== null && children(target)}
		</ModalHost>
	)
}
