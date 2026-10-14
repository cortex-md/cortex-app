import { useMembersStore, useServerCapabilities } from "@cortex/core"
import { roleInfo } from "@cortex/core/members"
import type { PathGrant, VaultInvite } from "@cortex/platform"
import {
	Button,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Spinner,
} from "@cortex/ui"
import { type FormEvent, useState } from "react"
import { ModalHost } from "@/utils/ModalHost"
import { SettingsGroup } from "../settings/SettingsPrimitives"
import { GuestAccessEditor } from "./GuestAccessEditor"
import { InviteLinkField } from "./InviteLinkField"
import { EMAIL_REGEX, messageOf } from "./memberDirectory"
import { RoleMenu } from "./RoleMenu"

interface InviteDialogProps {
	vaultId: string
	roles: readonly string[]
	open: boolean
	onOpenChange(open: boolean): void
}

export function InviteDialog({ vaultId, roles, open, onOpenChange }: InviteDialogProps) {
	return (
		<ModalHost open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[480px]">
				<InviteForm vaultId={vaultId} roles={roles} onDone={() => onOpenChange(false)} />
			</DialogContent>
		</ModalHost>
	)
}

interface InviteFormProps {
	vaultId: string
	roles: readonly string[]
	onDone(): void
}

function InviteForm({ vaultId, roles, onDone }: InviteFormProps) {
	const createInvite = useMembersStore((state) => state.createInvite)
	const clearError = useMembersStore((state) => state.clearError)
	const capabilities = useServerCapabilities()
	const [email, setEmail] = useState("")
	const [role, setRole] = useState("editor")
	const [grants, setGrants] = useState<PathGrant[]>([])
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [invite, setInvite] = useState<VaultInvite | null>(null)

	const emailEnabled = capabilities?.features.email !== false
	const isGuest = role === "guest"
	const canSubmit = EMAIL_REGEX.test(email.trim()) && (!isGuest || grants.length > 0) && !busy

	const submit = async (event: FormEvent) => {
		event.preventDefault()
		if (!canSubmit) return
		clearError()
		setBusy(true)
		setError(null)
		try {
			setInvite(
				await createInvite(vaultId, email.trim(), role, "", isGuest ? { grants } : undefined),
			)
		} catch (cause) {
			setError(messageOf(cause))
		} finally {
			setBusy(false)
		}
	}

	if (invite) {
		return (
			<>
				<DialogHeader>
					<DialogTitle>Invite created</DialogTitle>
					<DialogDescription>
						{invite.inviteeEmail} joins as {roleInfo(invite.role).label.toLowerCase()} once they
						accept.
					</DialogDescription>
				</DialogHeader>
				{invite.inviteUrl ? (
					<SettingsGroup>
						<InviteLinkField invite={invite} emailEnabled={emailEnabled} />
					</SettingsGroup>
				) : (
					<p className="share-muted">
						{emailEnabled ? "An email is on its way." : "Share the vault with them in Cortex."}
					</p>
				)}
				<DialogFooter>
					<Button
						size="sm"
						variant="secondary"
						onClick={() => {
							setInvite(null)
							setEmail("")
							setGrants([])
						}}
					>
						Invite another
					</Button>
					<Button size="sm" onClick={onDone}>
						Done
					</Button>
				</DialogFooter>
			</>
		)
	}

	return (
		<form className="contents" onSubmit={(event) => void submit(event)}>
			<DialogHeader>
				<DialogTitle>Invite people</DialogTitle>
				<DialogDescription>
					They get a link to join this vault with the role you pick.
				</DialogDescription>
			</DialogHeader>
			<div className="form-dialog-fields">
				<div className="form-dialog-field">
					<label htmlFor="invite-email" className="form-dialog-label">
						Email
					</label>
					<Input
						id="invite-email"
						type="email"
						autoFocus
						placeholder="name@example.com"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
					/>
				</div>
				<div className="form-dialog-field">
					<p className="form-dialog-label">Role</p>
					<div className="flex items-center gap-2">
						<RoleMenu label="Invite role" value={role} roles={roles} onChange={setRole} />
						<span className="share-muted">{roleInfo(role).description}</span>
					</div>
				</div>
				{isGuest && (
					<div className="form-dialog-field">
						<p className="form-dialog-label">Notes and folders they can open</p>
						<SettingsGroup>
							<GuestAccessEditor grants={grants} onChange={setGrants} />
						</SettingsGroup>
					</div>
				)}
				{error && <p className="settings-section-error">{error}</p>}
			</div>
			<DialogFooter>
				<Button size="sm" type="submit" disabled={!canSubmit}>
					{busy && <Spinner className="size-3" />}
					{emailEnabled ? "Send invite" : "Create invite"}
				</Button>
			</DialogFooter>
		</form>
	)
}
