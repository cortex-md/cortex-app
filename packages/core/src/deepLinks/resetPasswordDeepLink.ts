import { getPlatform } from "@cortex/platform"

export interface ResetPasswordTarget {
	token: string
	serverUrl: string | null
}

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

export function startResetPasswordDeepLinks(
	openResetPassword: (target: ResetPasswordTarget) => void,
): () => void {
	return getPlatform().app.onDeepLinkOpen((urls) => {
		const target = urls.map(parseResetPasswordDeepLink).find((link) => link !== null)
		if (target) openResetPassword(target)
	})
}
