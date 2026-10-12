import { getPlatform } from "@cortex/platform"
import { useEffect } from "react"
import { type ResetPasswordTarget, resetPasswordModal } from "../features/auth/resetPasswordModal"

export function parseResetPasswordDeepLink(value: string): ResetPasswordTarget | null {
	try {
		const url = new URL(value)
		if (url.protocol !== "cortex:" || url.hostname !== "reset-password") return null
		const token = url.searchParams.get("token")?.trim()
		if (!token) return null
		const serverUrl = url.searchParams.get("server")?.trim() || null
		if (serverUrl && !/^https?:\/\//i.test(serverUrl)) return null
		return { token, serverUrl }
	} catch {
		return null
	}
}

function startResetPasswordDeepLinks(): () => void {
	return getPlatform().app.onDeepLinkOpen((urls) => {
		const target = urls.map(parseResetPasswordDeepLink).find((link) => link !== null)
		if (target) resetPasswordModal.open(target)
	})
}

export function useResetPasswordDeepLink() {
	useEffect(() => startResetPasswordDeepLinks(), [])
}
