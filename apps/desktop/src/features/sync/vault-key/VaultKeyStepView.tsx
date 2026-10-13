import { Button, Input, Label, Spinner } from "@cortex/ui"
import { Hourglass, KeyRound, Lock } from "lucide-react"
import { type ReactNode, useEffect, useEffectEvent, useId, useState } from "react"
import { RecoveryKeyPanel } from "../../auth/RecoveryKeyPanel"
import { FlowBody, FlowError, FlowFooter, FlowHeader, FlowNote } from "../../vault/FlowDialog"
import type { VaultKeyFlow } from "./useVaultKeyFlow"
import { VAULT_KEY_POLL_MS, type VaultKeyDraft } from "./vaultKeyDraft"

interface VaultKeyStepViewProps {
	draft: VaultKeyDraft
	flow: VaultKeyFlow
	updateDraft: (nextDraft: Partial<VaultKeyDraft>) => void
	targetName: string
	progress?: ReactNode
	onBack?: () => void
	onClose: () => void
	submitLabel: string
}

function WaitingPoller({ onCheck }: { onCheck: () => Promise<void> }) {
	const check = useEffectEvent(() => {
		void onCheck()
	})
	useEffect(() => {
		const interval = setInterval(check, VAULT_KEY_POLL_MS)
		return () => clearInterval(interval)
	}, [])
	return null
}

export function VaultKeyStepView({
	draft,
	flow,
	updateDraft,
	targetName,
	progress,
	onBack,
	onClose,
	submitLabel,
}: VaultKeyStepViewProps) {
	const inputId = useId()
	const [checking, setChecking] = useState(false)
	const { encryptionStep, password, encryptionError, encryptionLoading, recoveryKey } = draft
	const changePassword = (event: React.ChangeEvent<HTMLInputElement>) =>
		updateDraft({ password: event.target.value, encryptionError: null })
	const backButton = onBack ? (
		<Button variant="ghost" size="sm" onClick={onBack} disabled={encryptionLoading}>
			Back
		</Button>
	) : null

	if (encryptionStep === "recovery-key" && recoveryKey) {
		return (
			<RecoveryKeyPanel
				recoveryKey={recoveryKey}
				confirmLabel="Continue"
				onDone={() => void flow.confirmRecoveryKeySaved()}
			/>
		)
	}

	if (encryptionStep === "setup-keys" || encryptionStep === "enter-password") {
		const setup = encryptionStep === "setup-keys"
		const submit = setup ? () => void flow.submitKeySetup() : () => void flow.submitVaultPassword()
		const ready = setup ? password.length >= 8 : password.length > 0
		return (
			<>
				<FlowHeader
					title={setup ? `Protect ${targetName}` : `Unlock ${targetName}`}
					lead={
						setup
							? "Notes are end-to-end encrypted. Enter your account password once on this device and vault keys are shared with you automatically."
							: `${targetName} still uses a vault password. Use the one set when it was created.`
					}
				>
					{progress}
				</FlowHeader>
				<FlowBody>
					<div className="mb-3 grid gap-1.5">
						<Label htmlFor={inputId} className="text-[12.5px] font-normal text-text-secondary">
							{setup ? "Account password" : "Encryption password"}
						</Label>
						<Input
							id={inputId}
							type="password"
							autoComplete={setup ? "current-password" : "off"}
							value={password}
							onChange={changePassword}
							onKeyDown={(event) => event.key === "Enter" && ready && submit()}
							autoFocus
						/>
					</div>
					<FlowNote icon={setup ? <KeyRound /> : <Lock />}>
						{setup
							? "You’ll need it on every device you sign in to."
							: "Ask the owner if you don’t have it."}
					</FlowNote>
					<FlowError>{encryptionError}</FlowError>
				</FlowBody>
				<FlowFooter start={backButton}>
					<Button size="sm" onClick={submit} disabled={!ready || encryptionLoading}>
						{encryptionLoading ? <Spinner className="size-3.5" /> : null}
						{submitLabel}
					</Button>
				</FlowFooter>
			</>
		)
	}

	if (encryptionStep === "waiting") {
		const checkNow = async () => {
			setChecking(true)
			try {
				await flow.checkAccess()
			} finally {
				setChecking(false)
			}
		}
		return (
			<>
				<WaitingPoller onCheck={flow.checkAccess} />
				<FlowHeader
					title="Waiting for access"
					lead={`${targetName} is linked. Its key is shared with you as soon as a vault admin’s device is online, and sync starts on its own.`}
				>
					{progress}
				</FlowHeader>
				<FlowBody>
					<FlowNote icon={<Hourglass />}>
						You can close this window. Cortex keeps checking.
					</FlowNote>
					<FlowError>{encryptionError}</FlowError>
				</FlowBody>
				<FlowFooter
					start={
						draft.hasPasswordKey ? (
							<Button
								variant="ghost"
								size="sm"
								onClick={() =>
									updateDraft({ encryptionStep: "enter-password", encryptionError: null })
								}
							>
								Use vault password
							</Button>
						) : null
					}
				>
					<Button variant="secondary" size="sm" disabled={checking} onClick={() => void checkNow()}>
						Check now
					</Button>
					<Button size="sm" onClick={onClose}>
						Close
					</Button>
				</FlowFooter>
			</>
		)
	}

	return (
		<>
			<FlowHeader title={`Unlock ${targetName}`} lead="Looking for the key to this vault.">
				{progress}
			</FlowHeader>
			<FlowBody className="flex items-center justify-center py-8">
				<Spinner className="size-4" />
			</FlowBody>
			<FlowFooter start={backButton} />
		</>
	)
}
