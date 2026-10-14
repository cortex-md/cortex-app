import { getPlatform } from "@cortex/platform"
import { useAuthStore } from "../stores/authStore"
import { useMembersStore } from "../stores/membersStore"
import { useRemoteVaultStore } from "../stores/remoteVaultStore"

export interface InviteDeepLink {
	token: string
	linkKey: string | null
}

export function parseInviteDeepLink(value: string): InviteDeepLink | null {
	try {
		const url = new URL(value)
		if (url.protocol !== "cortex:" || url.hostname !== "invite") return null
		const token = decodeURIComponent(url.pathname.replace(/^\/+/, ""))
		if (!token) return null
		const linkKey = new URLSearchParams(url.hash.replace(/^#/, "")).get("k")
		return { token, linkKey }
	} catch {
		return null
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

async function acceptInvite({ token, linkKey }: InviteDeepLink): Promise<void> {
	const dialog = getPlatform().dialog
	if (!useAuthStore.getState().authenticated) {
		await dialog.showAlert({
			title: "Sign in to join",
			message: "Sign in to Cortex Sync, then open the invite link again.",
		})
		return
	}
	const members = useMembersStore.getState()
	const preview = await members.previewInvite(token)
	const confirmed = await dialog.showConfirm({
		title: `Join ${preview.vaultName}`,
		message: `${preview.inviterName} invited you to ${preview.vaultName} as ${preview.role}.`,
		confirmLabel: "Join vault",
	})
	if (!confirmed) return
	const vault = await members.acceptInviteLink(token, linkKey)
	await useRemoteVaultStore.getState().fetchRemoteVaults()
	await dialog.showAlert({
		title: `You joined ${vault.name}`,
		message: "Link it to a local folder from Settings → Sync to start syncing.",
	})
}

export function startInviteDeepLinks(): () => void {
	let processing = false
	return getPlatform().app.onDeepLinkOpen((urls) => {
		const invite = urls.map(parseInviteDeepLink).find((link) => link !== null)
		if (!invite || processing) return
		processing = true
		void acceptInvite(invite)
			.catch((error) =>
				getPlatform().dialog.showAlert({
					title: "Could not join the vault",
					message: errorMessage(error),
					kind: "error",
				}),
			)
			.finally(() => {
				processing = false
			})
	})
}
