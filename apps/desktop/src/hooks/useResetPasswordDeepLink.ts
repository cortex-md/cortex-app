import { startResetPasswordDeepLinks } from "@cortex/core"
import { useEffect } from "react"
import { resetPasswordModal } from "../features/auth/resetPasswordModal"

export { parseResetPasswordDeepLink } from "@cortex/core"

export function useResetPasswordDeepLink() {
	useEffect(() => startResetPasswordDeepLinks((target) => resetPasswordModal.open(target)), [])
}
