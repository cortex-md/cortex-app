import { getErrorMessage, useAuthStore } from "@cortex/core"
import { useState } from "react"
import { Alert, Modal, Platform, StyleSheet, View } from "react-native"

import { FormSection, NativeForm } from "@/components/ui/Form"
import { RecoveryKeySection } from "@/features/account/RecoveryKeySection"
import { toast } from "@/features/feedback/useToast"
import { FormButton, FormHeader, FormTextField } from "@/features/onboarding/FormControls"
import { cleanErrorMessage } from "@/features/vault/vaultErrors"
import { useMobileColors } from "@/hooks/useMobileColors"

type AuthMode = "sign-in" | "create"

interface AuthDraft {
	confirm: string
	displayName: string
	email: string
	password: string
}

const emptyDraft: AuthDraft = { confirm: "", displayName: "", email: "", password: "" }

function validateDraft(mode: AuthMode, draft: AuthDraft): string | null {
	if (!draft.email.trim() || !draft.password) return "Enter your email and password."
	if (mode === "sign-in") return null
	if (!draft.displayName.trim()) return "Enter a display name."
	if (draft.password.length < 8) return "Password must be at least 8 characters."
	if (draft.password !== draft.confirm) return "Passwords do not match."
	return null
}

function showAuthError(mode: AuthMode, message: string): void {
	Alert.alert(mode === "sign-in" ? "Couldn't sign in" : "Couldn't create the account", message)
}

async function submitAuth(
	mode: AuthMode,
	draft: AuthDraft,
	setBusy: (busy: boolean) => void,
	onDone: (recoveryKey: string | null) => void,
): Promise<void> {
	const validation = validateDraft(mode, draft)
	if (validation) {
		showAuthError(mode, validation)
		return
	}
	setBusy(true)
	try {
		const auth = useAuthStore.getState()
		const recoveryKey =
			mode === "sign-in"
				? await auth.login(draft.email.trim(), draft.password)
				: await auth.register(draft.email.trim(), draft.password, draft.displayName.trim())
		toast(mode === "sign-in" ? "Signed in" : "Account created")
		onDone(recoveryKey)
	} catch (error) {
		showAuthError(mode, cleanErrorMessage(getErrorMessage(error)))
	} finally {
		setBusy(false)
	}
}

export function SignInSheet({ onClose, visible }: { onClose: () => void; visible: boolean }) {
	const { colors } = useMobileColors()
	const [mode, setMode] = useState<AuthMode>("sign-in")
	const [draft, setDraft] = useState<AuthDraft>(emptyDraft)
	const [busy, setBusy] = useState(false)
	const [recoveryKey, setRecoveryKey] = useState<string | null>(null)
	const isCreate = mode === "create"

	function update(key: keyof AuthDraft, value: string) {
		setDraft((current) => ({ ...current, [key]: value }))
	}

	function submit() {
		void submitAuth(mode, draft, setBusy, (nextRecoveryKey) => {
			if (nextRecoveryKey) setRecoveryKey(nextRecoveryKey)
			else onClose()
		})
	}

	return (
		<Modal
			animationType="slide"
			onRequestClose={onClose}
			presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
			visible={visible}
		>
			<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
				{recoveryKey ? (
					<NativeForm>
						<FormSection>
							<FormHeader title="Save your recovery key" />
						</FormSection>
						<RecoveryKeySection
							onDone={() => {
								setRecoveryKey(null)
								onClose()
							}}
							recoveryKey={recoveryKey}
						/>
					</NativeForm>
				) : (
					<NativeForm>
						<FormSection>
							<FormHeader title={isCreate ? "Create account" : "Sign in"} />
						</FormSection>
						<FormSection key={mode}>
							{isCreate ? (
								<FormTextField
									autoCapitalize="words"
									defaultValue={draft.displayName}
									label="Display name"
									onChangeText={(value) => update("displayName", value)}
								/>
							) : null}
							<FormTextField
								autoCapitalize="none"
								defaultValue={draft.email}
								keyboard="email"
								label="Email"
								onChangeText={(value) => update("email", value)}
							/>
							<FormTextField
								autoCapitalize="none"
								label="Password"
								onChangeText={(value) => update("password", value)}
								onSubmit={isCreate ? undefined : submit}
								secure
							/>
							{isCreate ? (
								<FormTextField
									autoCapitalize="none"
									label="Confirm password"
									onChangeText={(value) => update("confirm", value)}
									onSubmit={submit}
									secure
								/>
							) : null}
						</FormSection>
						<FormSection>
							<FormButton
								disabled={busy}
								label={isCreate ? "Create account" : "Sign in"}
								onPress={submit}
							/>
							<FormButton
								disabled={busy}
								label={isCreate ? "I already have an account" : "Create an account"}
								onPress={() => {
									setMode(isCreate ? "sign-in" : "create")
									setDraft((current) => ({ ...current, confirm: "", password: "" }))
								}}
								variant="secondary"
							/>
							<FormButton disabled={busy} label="Cancel" onPress={onClose} variant="plain" />
						</FormSection>
					</NativeForm>
				)}
			</View>
		</Modal>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
})
