import type { VaultInvite } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { Button } from "@cortex/ui"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useCopyFeedback } from "@/hooks/useCopyFeedback"
import { SettingsField } from "../settings/SettingsPrimitives"

export function CopyButton({ value, label = "Copy link" }: { value: string; label?: string }) {
	const [copied, markCopied] = useCopyFeedback()
	return (
		<Button
			variant="secondary"
			onClick={() => {
				void getPlatform().clipboard.writeText(value).then(markCopied)
			}}
		>
			{copied ? <CheckIcon /> : <CopyIcon />}
			{copied ? "Copied" : label}
		</Button>
	)
}

export function InviteLinkField({
	invite,
	emailEnabled,
}: {
	invite: VaultInvite
	emailEnabled: boolean
}) {
	if (!invite.inviteUrl) return null
	return (
		<SettingsField
			label={`Invite link for ${invite.inviteeEmail}`}
			description={
				emailEnabled
					? "An email is on its way. You can also share this link directly."
					: "This server does not send email. Share this link with them."
			}
		>
			<CopyButton value={invite.inviteUrl} />
		</SettingsField>
	)
}
