import { startSharedNoteDeepLinks } from "@cortex/core"
import { useEffect } from "react"

export { parseSharedNoteDeepLink, type SharedNoteDeepLink } from "@cortex/core"

export function useSharedNoteDeepLink() {
	useEffect(() => startSharedNoteDeepLinks(), [])
}
