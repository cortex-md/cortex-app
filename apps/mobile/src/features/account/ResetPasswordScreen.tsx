import { getErrorMessage, useAuthStore } from "@cortex/core"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { useState } from "react"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"
import { readParam } from "@/features/history/useVersionHistory"
import { FormTextField } from "@/features/sync/FormControls"

const MIN_PASSWORD_LENGTH = 8

function validateNewPassword(password: string, confirmation: string): string | null {
	if (password !== confirmation) return "Passwords do not match"
	if (password.length < MIN_PASSWORD_LENGTH) {
		return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
	}
	return null
}

function serverHost(serverUrl: string): string {
	try {
		return new URL(serverUrl).host
	} catch {
		return serverUrl
	}
}

function close(): void {
	if (router.canGoBack()) router.back()
	else router.replace("/")
}

export function ResetPasswordScreen() {
	const params = useLocalSearchParams<{ token?: string | string[]; server?: string | string[] }>()
	const token = readParam(params.token)
	const requestedServer = readParam(params.server)
	const currentServerUrl = useAuthStore((state) => state.serverUrl)
	const resetPassword = useAuthStore((state) => state.resetPassword)
	const serverUrl =
		requestedServer && /^https?:\/\//i.test(requestedServer) ? requestedServer : currentServerUrl
	const [password, setPassword] = useState("")
	const [confirm, setConfirm] = useState("")
	const [recoveryKey, setRecoveryKey] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const submit = async () => {
		if (!token || busy) return
		const validation = validateNewPassword(password, confirm)
		if (validation) {
			setError(validation)
			return
		}
		setBusy(true)
		setError(null)
		try {
			await resetPassword(serverUrl, token, password, recoveryKey.trim() || null)
			toast("Password changed. Sign in with the new password.")
			close()
		} catch (resetError) {
			setError(getErrorMessage(resetError))
		} finally {
			setBusy(false)
		}
	}

	return (
		<>
			<Stack.Screen options={{ headerLargeTitleEnabled: false, title: "New password" }} />
			<NativeForm>
				{token ? (
					<>
						<FormSection
							footer={error ?? `For your account on ${serverHost(serverUrl)}.`}
							title="Choose a new password"
						>
							<FormTextField
								autoFocus
								onChangeText={setPassword}
								placeholder="New password"
								secure
							/>
							<FormTextField
								onChangeText={setConfirm}
								onSubmit={() => void submit()}
								placeholder="Confirm password"
								secure
							/>
						</FormSection>
						<FormSection
							footer="Keeps access to your encrypted notes. Without it, end-to-end encrypted vaults must be shared with you again."
							title="Recovery key"
						>
							<FormTextField monospace onChangeText={setRecoveryKey} placeholder="Optional" />
						</FormSection>
						<FormSection>
							<FormRow
								disabled={busy || !password}
								onPress={() => void submit()}
								tint
								title={busy ? "Changing…" : "Change password"}
							/>
						</FormSection>
					</>
				) : (
					<FormSection footer="Open the reset link from your email again.">
						<FormRow title="This reset link is incomplete" />
					</FormSection>
				)}
			</NativeForm>
		</>
	)
}
