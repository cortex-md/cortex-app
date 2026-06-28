import { useEffect } from "react"
import { useHotkeysStore } from "./hotkeysStore"

export function useHotkey(id: string, handler: () => void): void {
	const registerHandler = useHotkeysStore((s) => s.registerHandler)
	const unregisterHandler = useHotkeysStore((s) => s.unregisterHandler)

	useEffect(() => {
		registerHandler(id, handler)
		return () => unregisterHandler(id)
	}, [id, handler, registerHandler, unregisterHandler])
}
