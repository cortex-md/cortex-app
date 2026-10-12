import { startSyncLifecycle } from "@cortex/core"
import { useEffect } from "react"

export function useSyncLifecycle() {
	useEffect(() => startSyncLifecycle(), [])
}
