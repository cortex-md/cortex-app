import { startLiveNoteShares } from "@cortex/core"
import { useEffect } from "react"
import { buildSharedNoteBundle } from "../features/sync/noteShareBundle"

export function useLiveNoteShares() {
	useEffect(() => startLiveNoteShares(buildSharedNoteBundle), [])
}
