import { useRemoteVaultStore, useServerCapabilities } from "@cortex/core"
import type { RemoteVaultInfo, RemoteVaultSettings } from "@cortex/platform"
import { Input, Progress, Switch } from "@cortex/ui"
import { useState } from "react"
import { formatBytes } from "@/utils/format"
import { SettingsField, SettingsGroup, SettingsSection } from "../settings/SettingsPrimitives"

function parseDomains(value: string): string[] {
	return value
		.split(/[\s,]+/)
		.map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
		.filter(Boolean)
}

interface VaultAccessSettingsProps {
	vault: RemoteVaultInfo
	onSaved(vault: RemoteVaultInfo): void
}

export function VaultAccessSettings({ vault, onSaved }: VaultAccessSettingsProps) {
	const capabilities = useServerCapabilities()
	const updateVaultSettings = useRemoteVaultStore((state) => state.updateVaultSettings)
	const [error, setError] = useState<string | null>(null)
	const domains = vault.allowedEmailDomains.join(", ")

	const save = (settings: RemoteVaultSettings) => {
		setError(null)
		void updateVaultSettings(vault.id, settings)
			.then(onSaved)
			.catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
	}

	const quota = vault.storageQuotaBytes
	const usage = quota ? Math.min(100, (vault.storageUsedBytes / quota) * 100) : null

	return (
		<SettingsSection title="Access" footer={error ?? undefined}>
			<SettingsGroup>
				{capabilities?.features.guests !== false && (
					<SettingsField
						htmlFor="vault-allow-guests"
						label="Guests"
						description="Let people outside the team see only the folders and notes you share."
					>
						<Switch
							id="vault-allow-guests"
							size="sm"
							checked={vault.allowGuests}
							onCheckedChange={(allowGuests) => save({ allowGuests })}
						/>
					</SettingsField>
				)}
				{capabilities?.features.publicLinks !== false && (
					<SettingsField
						htmlFor="vault-allow-public-links"
						label="Public links"
						description="Let editors share read-only links to notes. Turning this off stops existing links."
					>
						<Switch
							id="vault-allow-public-links"
							size="sm"
							checked={vault.allowPublicLinks}
							onCheckedChange={(allowPublicLinks) => save({ allowPublicLinks })}
						/>
					</SettingsField>
				)}
				<SettingsField
					htmlFor="vault-allowed-domains"
					label="Allowed email domains"
					description="Only invite addresses from these domains. Leave empty to allow any."
				>
					<Input
						key={domains}
						id="vault-allowed-domains"
						placeholder="example.com"
						defaultValue={domains}
						onBlur={(event) => {
							const next = parseDomains(event.target.value)
							if (next.join(", ") !== domains) save({ allowedEmailDomains: next })
						}}
					/>
				</SettingsField>
				<SettingsField
					label="Storage"
					description={
						quota
							? `${formatBytes(vault.storageUsedBytes)} of ${formatBytes(quota)} used, including version history`
							: `${formatBytes(vault.storageUsedBytes)} used, including version history`
					}
				>
					{usage !== null && <Progress value={usage} className="w-32" />}
				</SettingsField>
			</SettingsGroup>
		</SettingsSection>
	)
}
