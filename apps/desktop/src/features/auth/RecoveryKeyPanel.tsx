import {
	Alert,
	AlertDescription,
	Button,
	Checkbox,
	DialogBody,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Label,
} from "@cortex/ui"
import { KeyRoundIcon } from "lucide-react"
import { useId, useState } from "react"
import { CopyButton } from "../sync/InviteLinkField"

interface RecoveryKeyPanelProps {
	recoveryKey: string
	title?: string
	confirmLabel?: string
	onDone(): void
}

export function RecoveryKeyPanel({
	recoveryKey,
	title = "Save your recovery key",
	confirmLabel = "Done",
	onDone,
}: RecoveryKeyPanelProps) {
	const [saved, setSaved] = useState(false)
	const checkboxId = useId()
	return (
		<>
			<DialogHeader className="dialog-chrome-header">
				<DialogTitle className="flex items-center gap-2">
					<KeyRoundIcon size={16} />
					{title}
				</DialogTitle>
				<DialogDescription>
					If you forget your password, this key is the only way to keep access to your encrypted
					vaults. It is shown only once.
				</DialogDescription>
			</DialogHeader>
			<DialogBody className="dialog-chrome-body flex flex-col gap-3">
				<output className="recovery-key-value" aria-label="Recovery key">
					{recoveryKey}
				</output>
				<div className="flex justify-end">
					<CopyButton value={recoveryKey} label="Copy key" />
				</div>
				<Alert>
					<AlertDescription>
						Store it in a password manager or print it. Cortex cannot show it again or recover it
						for you.
					</AlertDescription>
				</Alert>
				<div className="flex items-center gap-2">
					<Checkbox
						id={checkboxId}
						checked={saved}
						onCheckedChange={(checked) => setSaved(checked === true)}
					/>
					<Label htmlFor={checkboxId} className="text-xs">
						I saved my recovery key somewhere safe
					</Label>
				</div>
			</DialogBody>
			<DialogFooter className="dialog-chrome-footer">
				<Button disabled={!saved} onClick={onDone}>
					{confirmLabel}
				</Button>
			</DialogFooter>
		</>
	)
}
