import { useAuthStore, useUIStore } from "@cortex/core"
import {
	Alert,
	AlertDescription,
	Button,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Spinner,
} from "@cortex/ui"
import { KeyRound } from "lucide-react"
import { type FormEvent, useState } from "react"
import { ModalStoreHost } from "@/utils/ModalHost"
import { validateNewPassword } from "./passwordValidation"
import { type ResetPasswordTarget, resetPasswordModal } from "./resetPasswordModal"

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

function formatServerHost(serverUrl: string): string {
	try {
		return new URL(serverUrl).host
	} catch {
		return serverUrl
	}
}

export function ResetPasswordHost() {
	return (
		<ModalStoreHost store={resetPasswordModal}>
			{(target) => <ResetPasswordContent key={target.token} target={target} />}
		</ModalStoreHost>
	)
}

function ResetPasswordContent({ target }: { target: ResetPasswordTarget }) {
	const currentServerUrl = useAuthStore((state) => state.serverUrl)
	const resetPassword = useAuthStore((state) => state.resetPassword)
	const openAuth = useUIStore((state) => state.openAuth)
	const serverUrl = target.serverUrl ?? currentServerUrl
	const [password, setPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [recoveryKey, setRecoveryKey] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [done, setDone] = useState(false)

	const submit = async (event: FormEvent) => {
		event.preventDefault()
		const validationError = validateNewPassword(password, confirmPassword)
		if (validationError) {
			setError(validationError)
			return
		}
		setBusy(true)
		setError(null)
		try {
			await resetPassword(serverUrl, target.token, password, recoveryKey.trim() || null)
			setDone(true)
		} catch (resetError) {
			setError(messageOf(resetError))
		} finally {
			setBusy(false)
		}
	}

	if (done) {
		return (
			<DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[440px]">
				<DialogHeader className="dialog-chrome-header">
					<DialogTitle>Password changed</DialogTitle>
					<DialogDescription>
						Sign in with your new password on {formatServerHost(serverUrl)}.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="dialog-chrome-footer">
					<Button
						onClick={() => {
							resetPasswordModal.close()
							openAuth("login")
						}}
					>
						Sign in
					</Button>
				</DialogFooter>
			</DialogContent>
		)
	}

	return (
		<DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[460px]">
			<form onSubmit={(event) => void submit(event)}>
				<DialogHeader className="dialog-chrome-header">
					<DialogTitle className="flex items-center gap-2">
						<KeyRound size={16} />
						Choose a new password
					</DialogTitle>
					<DialogDescription>For your account on {formatServerHost(serverUrl)}.</DialogDescription>
				</DialogHeader>
				<DialogBody className="dialog-chrome-body flex flex-col gap-3">
					<div>
						<Label htmlFor="reset-password-new" className="text-xs">
							New password
						</Label>
						<Input
							id="reset-password-new"
							type="password"
							autoComplete="new-password"
							className="mt-1"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							autoFocus
						/>
					</div>
					<div>
						<Label htmlFor="reset-password-confirm" className="text-xs">
							Confirm password
						</Label>
						<Input
							id="reset-password-confirm"
							type="password"
							autoComplete="new-password"
							className="mt-1"
							value={confirmPassword}
							onChange={(event) => setConfirmPassword(event.target.value)}
						/>
					</div>
					<div>
						<Label htmlFor="reset-password-recovery" className="text-xs">
							Recovery key (optional)
						</Label>
						<Input
							id="reset-password-recovery"
							className="mt-1 font-mono"
							placeholder="XXXX-XXXX-XXXX-…"
							spellCheck={false}
							autoComplete="off"
							value={recoveryKey}
							onChange={(event) => setRecoveryKey(event.target.value)}
						/>
					</div>
					<Alert>
						<AlertDescription>
							With your recovery key you keep immediate access to your encrypted vaults. Without it,
							access to shared vaults comes back when a vault admin grants it again or when another
							of your signed-in devices is online.
						</AlertDescription>
					</Alert>
					{error && <p className="text-xs text-status-error-foreground">{error}</p>}
				</DialogBody>
				<DialogFooter className="dialog-chrome-footer">
					<DialogClose asChild>
						<Button type="button" variant="ghost">
							Cancel
						</Button>
					</DialogClose>
					<Button type="submit" disabled={busy || !password || !confirmPassword}>
						{busy && <Spinner className="size-3" />}
						Change password
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	)
}
