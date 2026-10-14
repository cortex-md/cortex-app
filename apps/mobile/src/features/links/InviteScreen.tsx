import { getErrorMessage, useAuthStore, useMembersStore, useRemoteVaultStore } from "@cortex/core"
import type { InvitePreview } from "@cortex/platform"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"
import { readParam } from "@/features/history/useVersionHistory"
import { openSettings } from "@/features/navigation/routes"

function close(): void {
	if (router.canGoBack()) router.back()
	else router.replace("/")
}

export function InviteScreen() {
	const params = useLocalSearchParams<{ token?: string | string[]; linkKey?: string | string[] }>()
	const token = readParam(params.token)
	const linkKey = readParam(params.linkKey)
	const authenticated = useAuthStore((state) => state.authenticated)
	const [preview, setPreview] = useState<InvitePreview | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	useEffect(() => {
		if (!token || !authenticated) return
		let canceled = false
		void useMembersStore
			.getState()
			.previewInvite(token)
			.then(
				(next) => {
					if (!canceled) setPreview(next)
				},
				(reason: unknown) => {
					if (!canceled) setError(getErrorMessage(reason))
				},
			)
		return () => {
			canceled = true
		}
	}, [authenticated, token])

	const join = async () => {
		if (!token || busy) return
		setBusy(true)
		try {
			const vault = await useMembersStore.getState().acceptInviteLink(token, linkKey)
			await useRemoteVaultStore.getState().fetchRemoteVaults()
			toast(`You joined ${vault.name}`)
			close()
			openSettings("sync/link")
		} catch (reason) {
			setError(getErrorMessage(reason))
		} finally {
			setBusy(false)
		}
	}

	const footer = !token
		? "This invite link is incomplete."
		: !authenticated
			? "Sign in to Cortex Sync, then open the invite link again."
			: (error ??
				(preview
					? `${preview.inviterName} invited you as ${preview.role}. After joining, link it to a folder on this device.`
					: "Checking the invite…"))

	return (
		<>
			<Stack.Screen
				options={{
					headerLargeTitleEnabled: false,
					title: preview ? `Join ${preview.vaultName}` : "Invite",
				}}
			/>
			<NativeForm>
				<FormSection footer={footer}>
					<FormRow
						disabled={!preview || busy}
						icon={{ sf: "person.badge.plus", md: "group_add" }}
						onPress={() => void join()}
						tint
						title={busy ? "Joining…" : "Join vault"}
					/>
				</FormSection>
				<FormSection>
					<FormRow onPress={close} title="Not now" />
				</FormSection>
			</NativeForm>
		</>
	)
}
