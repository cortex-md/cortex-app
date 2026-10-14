import { startInviteDeepLinks } from "@cortex/core"
import { useEffect } from "react"

export { type InviteDeepLink, parseInviteDeepLink } from "@cortex/core"

export function useInviteDeepLink() {
	useEffect(() => startInviteDeepLinks(), [])
}
