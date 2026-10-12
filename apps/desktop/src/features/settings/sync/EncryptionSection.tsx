import { useAccountStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { Button, DialogContent, Input, Spinner } from "@cortex/ui"
import { FingerprintIcon, KeyRoundIcon, LockKeyholeIcon } from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"
import { ModalHost } from "@/utils/ModalHost"
import { RecoveryKeyPanel } from "../../auth/RecoveryKeyPanel"
import { SettingsField, SettingsGroup, SettingsSection } from "../SettingsPrimitives"

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

function formatFingerprint(fingerprint: string): string {
	return fingerprint.includes(" ")
		? fingerprint
		: (fingerprint.match(/.{1,4}/g)?.join(" ") ?? fingerprint)
}

function KeySetupForm({ onRecoveryKey }: { onRecoveryKey(recoveryKey: string): void }) {
	const keyStatus = useAccountStore((state) => state.keyStatus)
	const setupKeys = useAccountStore((state) => state.setupKeys)
	const [password, setPassword] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const upgrading = keyStatus?.kdfVersion === 0

	const submit = async (event: FormEvent) => {
		event.preventDefault()
		setBusy(true)
		setError(null)
		try {
			const result = await setupKeys(password)
			setPassword("")
			if (result.recoveryKey) onRecoveryKey(result.recoveryKey)
		} catch (setupError) {
			setError(messageOf(setupError))
		} finally {
			setBusy(false)
		}
	}

	return (
		<form className="settings-field-form" onSubmit={(event) => void submit(event)}>
			<SettingsField
				htmlFor="account-key-setup-password"
				icon={<LockKeyholeIcon />}
				label={upgrading ? "Set up end-to-end encryption" : "Unlock your encryption keys"}
				description={
					error ??
					(upgrading
						? "Enter your account password once to create your encryption keys. Shared vaults then unlock on this device without a separate vault password."
						: "Enter your account password to unlock your encryption keys on this device.")
				}
			>
				<div className="flex w-full gap-2">
					<Input
						id="account-key-setup-password"
						type="password"
						autoComplete="current-password"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
					/>
					<Button type="submit" size="sm" disabled={busy || password.length < 8}>
						{busy && <Spinner className="size-3" />}
						{upgrading ? "Set up" : "Unlock"}
					</Button>
				</div>
			</SettingsField>
		</form>
	)
}

export function EncryptionSection() {
	const keyStatus = useAccountStore((state) => state.keyStatus)
	const loadKeyStatus = useAccountStore((state) => state.loadKeyStatus)
	const regenerateRecoveryKey = useAccountStore((state) => state.regenerateRecoveryKey)
	const [recoveryKey, setRecoveryKey] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)
	const [status, setStatus] = useState<string | null>(null)

	// oxlint-disable-next-line react-doctor/no-event-handler -- key status follows the signed-in account page
	useEffect(() => {
		void loadKeyStatus()
	}, [loadKeyStatus])

	if (!keyStatus) return null

	const needsSetup = keyStatus.kdfVersion === 0 || !keyStatus.hasLocalIdentity

	const regenerate = async () => {
		const confirmed = await getPlatform().dialog.showConfirm({
			title: "Generate a new recovery key",
			message: "Your current recovery key stops working. Save the new one before closing it.",
			confirmLabel: "Generate",
		})
		if (!confirmed) return
		setBusy(true)
		setStatus(null)
		try {
			setRecoveryKey(await regenerateRecoveryKey())
		} catch (error) {
			setStatus(messageOf(error))
		} finally {
			setBusy(false)
		}
	}

	return (
		<SettingsSection
			title="Encryption"
			footer={
				status ??
				"Vault keys are shared with your encryption key, so the server never sees your notes."
			}
		>
			<SettingsGroup>
				{needsSetup ? (
					<KeySetupForm onRecoveryKey={setRecoveryKey} />
				) : (
					<>
						<SettingsField
							icon={<FingerprintIcon />}
							label="Your key fingerprint"
							description="Compare it with an admin when they verify your key."
						>
							<code className="settings-fingerprint">
								{keyStatus.fingerprint ? formatFingerprint(keyStatus.fingerprint) : "Unavailable"}
							</code>
						</SettingsField>
						<SettingsField
							icon={<KeyRoundIcon />}
							label="Recovery key"
							description={
								keyStatus.hasRecoveryKey
									? "Set up. Use it to keep access to your vaults after a password reset."
									: "Not set up. Without it, a password reset waits for an admin or another of your devices."
							}
						>
							<Button
								variant="secondary"
								size="sm"
								disabled={busy}
								onClick={() => void regenerate()}
							>
								{busy && <Spinner className="size-3" />}
								{keyStatus.hasRecoveryKey ? "Generate new recovery key" : "Create recovery key"}
							</Button>
						</SettingsField>
					</>
				)}
			</SettingsGroup>
			<ModalHost open={recoveryKey !== null} onOpenChange={() => {}}>
				{recoveryKey && (
					<DialogContent
						className="gap-0 overflow-hidden p-0 sm:max-w-[460px]"
						showCloseButton={false}
					>
						<RecoveryKeyPanel recoveryKey={recoveryKey} onDone={() => setRecoveryKey(null)} />
					</DialogContent>
				)}
			</ModalHost>
		</SettingsSection>
	)
}
