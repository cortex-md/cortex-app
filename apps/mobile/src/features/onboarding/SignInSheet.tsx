import { getErrorMessage, useAuthStore } from "@cortex/core"
import { useState } from "react"
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from "react-native"

import { MobileTextField } from "@/components/ui/MobileTextField"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { SheetHeader } from "@/components/ui/SheetHeader"
import { OnboardingButton } from "@/features/onboarding/OnboardingChrome"
import { toast } from "@/features/feedback/useToast"
import { useMobileColors } from "@/hooks/useMobileColors"

type AuthMode = "sign-in" | "create"

const modeOptions: { label: string; value: AuthMode }[] = [
	{ label: "Sign in", value: "sign-in" },
	{ label: "Create account", value: "create" },
]

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
	if (draft.password.length < 8) return "Password must be at least 8 characters"
	if (draft.password !== draft.confirm) return "Passwords do not match"
	return null
}

async function submitAuth(
	mode: AuthMode,
	draft: AuthDraft,
	setBusy: (busy: boolean) => void,
	setError: (error: string | null) => void,
	onDone: () => void,
): Promise<void> {
	const validation = validateDraft(mode, draft)
	if (validation) {
		setError(validation)
		return
	}
	setBusy(true)
	setError(null)
	try {
		const auth = useAuthStore.getState()
		const failure =
			mode === "sign-in"
				? await auth.login(draft.email.trim(), draft.password)
				: await auth.register(draft.email.trim(), draft.password, draft.displayName.trim())
		if (failure) {
			setError(failure)
			return
		}
		toast(mode === "sign-in" ? "Signed in" : "Account created")
		onDone()
	} catch (error) {
		setError(getErrorMessage(error))
	} finally {
		setBusy(false)
	}
}

export function SignInSheet({ onClose, visible }: { onClose: () => void; visible: boolean }) {
	const { colors } = useMobileColors()
	const [mode, setMode] = useState<AuthMode>("sign-in")
	const [draft, setDraft] = useState<AuthDraft>(emptyDraft)
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)
	const isCreate = mode === "create"

	function update(key: keyof AuthDraft, value: string) {
		setDraft((current) => ({ ...current, [key]: value }))
		setError(null)
	}

	return (
		<Modal
			animationType="slide"
			onRequestClose={onClose}
			presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
			visible={visible}
		>
			<KeyboardAvoidingView behavior="padding" style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
				<SheetHeader onClose={onClose} title={isCreate ? "Create account" : "Sign in"} />
				<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
					<SegmentedControl
						accessibilityLabel="Account"
						onChange={(value) => {
							setMode(value)
							setError(null)
						}}
						options={modeOptions}
						value={mode}
					/>
					<View style={styles.fields}>
						{isCreate ? (
							<MobileTextField
								autoCapitalize="words"
								label="Display name"
								onChangeText={(value) => update("displayName", value)}
								placeholder="How others will see you"
								value={draft.displayName}
							/>
						) : null}
						<MobileTextField
							autoCapitalize="none"
							autoComplete="email"
							keyboardType="email-address"
							label="Email"
							onChangeText={(value) => update("email", value)}
							placeholder="you@example.com"
							value={draft.email}
						/>
						<MobileTextField
							autoCapitalize="none"
							label="Password"
							onChangeText={(value) => update("password", value)}
							placeholder={isCreate ? "At least 8 characters" : "Your password"}
							secureTextEntry
							value={draft.password}
						/>
						{isCreate ? (
							<MobileTextField
								autoCapitalize="none"
								label="Confirm password"
								onChangeText={(value) => update("confirm", value)}
								placeholder="Repeat your password"
								secureTextEntry
								value={draft.confirm}
							/>
						) : null}
					</View>
					{error ? <Text style={[styles.error, { color: colors.destructiveText }]}>{error}</Text> : null}
					<OnboardingButton
						busy={busy}
						label={isCreate ? "Create account" : "Sign in"}
						onPress={() => void submitAuth(mode, draft, setBusy, setError, onClose)}
						variant="primary"
					/>
					<Text style={[styles.switchText, { color: colors.secondaryLabel }]}>
						{isCreate ? "Already have an account? " : "No account yet? "}
						<Text
							onPress={() => setMode(isCreate ? "sign-in" : "create")}
							style={[styles.switchLink, { color: colors.tint }]}
						>
							{isCreate ? "Sign in" : "Create one"}
						</Text>
					</Text>
				</ScrollView>
			</KeyboardAvoidingView>
		</Modal>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: 20,
		padding: 16,
	},
	error: {
		fontSize: 13,
		fontWeight: "500",
		lineHeight: 18,
	},
	fields: {
		gap: 16,
	},
	root: {
		flex: 1,
	},
	switchLink: {
		fontWeight: "600",
	},
	switchText: {
		fontSize: 15,
		lineHeight: 20,
		textAlign: "center",
	},
})
