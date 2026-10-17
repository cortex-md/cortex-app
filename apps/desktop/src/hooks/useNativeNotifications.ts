import { startNativeNotifications } from "@cortex/core"
import { useEffect } from "react"

export function useNativeNotifications() {
	useEffect(() => startNativeNotifications(), [])
}
