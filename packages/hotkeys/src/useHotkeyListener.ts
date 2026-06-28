import { useEffect } from "react"
import { useHotkeysStore } from "./hotkeysStore"

export function useHotkeyListener(): void {
	const handleKeyEvent = useHotkeysStore((s) => s.handleKeyEvent)

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			handleKeyEvent(event)
		}
		window.addEventListener("keydown", onKeyDown)
		return () => window.removeEventListener("keydown", onKeyDown)
	}, [handleKeyEvent])
}
