import { getErrorMessage, useAccountStore } from "@cortex/core"
import { router } from "expo-router"
import { useState } from "react"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"
import { FormTextField } from "@/features/sync/FormControls"

const MIN_PASSWORD_LENGTH = 8

export function ChangePasswordScreen() {
	const changePassword = useAccountStore((state) => state.changePassword)
	const [current, setCurrent] = useState("")
	const [next, setNext] = useState("")
	const [confirm, setConfirm] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const submit = async () => {
		if (busy) return
		if (next !== confirm) {
			setError("Passwords do not match")
			return
		}
		if (next.length < MIN_PASSWORD_LENGTH) {
			setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
			return
		}
		setBusy(true)
		setError(null)
		try {
			await changePassword(current, next)
			toast("Password changed")
			if (router.canGoBack()) router.back()
		} catch (changeError) {
			setError(getErrorMessage(changeError))
		} finally {
			setBusy(false)
		}
	}

	return (
		<NativeForm>
			<FormSection title="Current password">
				<FormTextField autoFocus onChangeText={setCurrent} placeholder="Current password" secure />
			</FormSection>
			<FormSection footer={error ?? undefined} title="New password">
				<FormTextField onChangeText={setNext} placeholder="New password" secure />
				<FormTextField
					onChangeText={setConfirm}
					onSubmit={() => void submit()}
					placeholder="Confirm password"
					secure
				/>
			</FormSection>
			<FormSection>
				<FormRow
					disabled={busy || !current || !next}
					onPress={() => void submit()}
					tint
					title={busy ? "Changing…" : "Change password"}
				/>
			</FormSection>
		</NativeForm>
	)
}
