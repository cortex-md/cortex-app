import { useSyncStore } from "@cortex/core"
import type { KeyTrustIssue, VaultMember } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { Button, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@cortex/ui"
import { ShieldAlertIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { ModalHost } from "@/utils/ModalHost"
import { SettingsGroup, SettingsList, SettingsListItem } from "../settings/SettingsPrimitives"
import { memberDisplayName, messageOf } from "./memberDirectory"
import { UserAvatar } from "./UserAvatar"

const EMPTY_TRUST_ISSUES: KeyTrustIssue[] = []

function formatFingerprint(fingerprint: string): string {
	return fingerprint.includes(" ")
		? fingerprint
		: (fingerprint.match(/.{1,4}/g)?.join(" ") ?? fingerprint)
}

interface KeyTrustBannerProps {
	vaultId: string
	canManage: boolean
	members: readonly VaultMember[]
}

export function KeyTrustBanner({ vaultId, canManage, members }: KeyTrustBannerProps) {
	const allIssues = useSyncStore((state) => state.keyTrustIssues)
	const [open, setOpen] = useState(false)
	const issues = useMemo(
		() =>
			allIssues.length === 0
				? EMPTY_TRUST_ISSUES
				: allIssues.filter((issue) => issue.vaultId === vaultId),
		[allIssues, vaultId],
	)
	if (issues.length === 0) return null

	return (
		<>
			<output className="members-trust-banner">
				<ShieldAlertIcon className="size-[15px] shrink-0" aria-hidden="true" />
				<span>
					{issues.length === 1
						? "1 member's security key changed"
						: `${issues.length} members' security keys changed`}
				</span>
				<Button variant="ghost" size="xs" onClick={() => setOpen(true)}>
					Review
				</Button>
			</output>
			<ModalHost open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-[480px]">
					<DialogHeader>
						<DialogTitle>Security key changes</DialogTitle>
						<DialogDescription>
							The vault key is not shared with a new key until an admin verifies it with the member.
						</DialogDescription>
					</DialogHeader>
					<KeyTrustList issues={issues} members={members} canManage={canManage} />
				</DialogContent>
			</ModalHost>
		</>
	)
}

interface KeyTrustListProps {
	issues: readonly KeyTrustIssue[]
	members: readonly VaultMember[]
	canManage: boolean
}

function KeyTrustList({ issues, members, canManage }: KeyTrustListProps) {
	const trustMemberKey = useSyncStore((state) => state.trustMemberKey)
	const [error, setError] = useState<string | null>(null)

	const verify = async (issue: KeyTrustIssue, name: string) => {
		const confirmed = await getPlatform().dialog.showConfirm({
			title: `Verify ${name}`,
			message: `Only continue if ${name} confirmed the new fingerprint ${formatFingerprint(issue.fingerprint)} through a channel you trust.`,
			confirmLabel: "Verify and grant",
		})
		if (!confirmed) return
		setError(null)
		try {
			await trustMemberKey(issue.vaultId, issue.userId, issue.fingerprint)
		} catch (cause) {
			setError(messageOf(cause))
		}
	}

	return (
		<>
			<SettingsGroup>
				<SettingsList>
					{issues.map((issue) => {
						const member = members.find((candidate) => candidate.userId === issue.userId)
						const name = member ? memberDisplayName(member) : "Unknown member"
						return (
							<SettingsListItem key={issue.userId} data-has-icon="true">
								<UserAvatar
									name={name}
									avatarUrl={member?.avatarUrl}
									className="settings-member-avatar"
								/>
								<div className="settings-member-copy">
									<span className="settings-field-label">{name}</span>
									<span className="settings-field-description settings-fingerprint">
										Was {formatFingerprint(issue.previousFingerprint)}
									</span>
									<span className="settings-field-description settings-fingerprint">
										Now {formatFingerprint(issue.fingerprint)}
									</span>
								</div>
								{canManage && (
									<div className="settings-row-trail">
										<Button size="sm" variant="secondary" onClick={() => void verify(issue, name)}>
											Verify and grant
										</Button>
									</div>
								)}
							</SettingsListItem>
						)
					})}
				</SettingsList>
			</SettingsGroup>
			{error && <p className="settings-section-error">{error}</p>}
			{!canManage && <p className="share-muted">Only vault admins can verify key changes.</p>}
		</>
	)
}
