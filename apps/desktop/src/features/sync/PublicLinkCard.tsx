import { useNoteSharesStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { Input, NativeSelect, NativeSelectOption, Spinner, Switch } from "@cortex/ui"
import { GlobeIcon } from "lucide-react"
import { useState } from "react"
import { CopyButton } from "./InviteLinkField"
import { messageOf } from "./memberDirectory"
import { buildSharedNoteBundle } from "./noteShareBundle"

const EXPIRY_OPTIONS = [
	{ value: "never", label: "Never expires", days: null },
	{ value: "1", label: "Expires in 1 day", days: 1 },
	{ value: "7", label: "Expires in 7 days", days: 7 },
	{ value: "30", label: "Expires in 30 days", days: 30 },
] as const

function expiryFor(value: string): string | null {
	const option = EXPIRY_OPTIONS.find((candidate) => candidate.value === value)
	return option?.days ? new Date(Date.now() + option.days * 86_400_000).toISOString() : null
}

interface PublicLinkCardProps {
	vaultId: string
	notePath: string
	filePath: string
	blockedReason: string | null
}

export function PublicLinkCard({
	vaultId,
	notePath,
	filePath,
	blockedReason,
}: PublicLinkCardProps) {
	const share = useNoteSharesStore((state) => state.sharesByPath[notePath] ?? null)
	const publish = useNoteSharesStore((state) => state.publish)
	const updateExpiry = useNoteSharesStore((state) => state.updateExpiry)
	const revoke = useNoteSharesStore((state) => state.revoke)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const disabled = busy || blockedReason !== null

	const run = async (task: () => Promise<unknown>) => {
		setBusy(true)
		setError(null)
		try {
			await task()
		} catch (cause) {
			setError(messageOf(cause))
		} finally {
			setBusy(false)
		}
	}

	const toggle = (on: boolean) =>
		void run(async () => {
			if (on) {
				await publish(vaultId, notePath, await buildSharedNoteBundle(filePath))
				return
			}
			if (!share) return
			const confirmed = await getPlatform().dialog.showConfirm({
				title: "Stop publishing",
				message: "The current link will stop working for everyone.",
				destructive: true,
				confirmLabel: "Stop publishing",
			})
			if (confirmed) await revoke(vaultId, share.id)
		})

	return (
		<section className="share-public-card" aria-labelledby="share-public-title">
			<div className="flex items-start gap-3">
				<span className="settings-icon-tile" aria-hidden="true">
					<GlobeIcon />
				</span>
				<div className="settings-member-copy">
					<label
						id="share-public-title"
						htmlFor="share-public-switch"
						className="settings-field-label"
					>
						Publish to web
					</label>
					<span className="settings-field-description share-public-description">
						Anyone with the link can read a read-only copy in their browser, without an account. The
						link contains the key, so the server can't read it.
					</span>
				</div>
				{busy && <Spinner className="size-3" />}
				<Switch
					id="share-public-switch"
					checked={share !== null}
					disabled={disabled}
					onCheckedChange={toggle}
				/>
			</div>
			{share && (
				<div className="grid gap-2">
					{share.link ? (
						<div className="flex items-center gap-2">
							<Input
								readOnly
								value={share.link}
								aria-label="Public link"
								onFocus={(event) => event.target.select()}
							/>
							<CopyButton value={share.link} />
						</div>
					) : (
						<p className="share-muted">Unlock this vault to see the link.</p>
					)}
					<NativeSelect
						aria-label="Link expiration"
						size="sm"
						disabled={disabled}
						value={share.expiresAt ? "custom" : "never"}
						onChange={(event) =>
							void run(() => updateExpiry(vaultId, share.id, expiryFor(event.target.value)))
						}
					>
						{share.expiresAt && (
							<NativeSelectOption value="custom">
								Expires {new Date(share.expiresAt).toLocaleDateString()}
							</NativeSelectOption>
						)}
						{EXPIRY_OPTIONS.map((option) => (
							<NativeSelectOption key={option.value} value={option.value}>
								{option.label}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</div>
			)}
			{(error ?? blockedReason) && (
				<p className={error ? "settings-section-error" : "share-muted"}>{error ?? blockedReason}</p>
			)}
		</section>
	)
}
