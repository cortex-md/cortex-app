import {
	DEFAULT_SELF_HOSTED_SYNC_SERVER_URL,
	useRemoteVaultStore,
	useVaultStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { Button, Input, Switch } from "@cortex/ui"
import { Loader2 } from "lucide-react"
import { type ChangeEvent, type KeyboardEvent, useEffect, useState } from "react"
import { SettingsField, SettingsGroup, SettingsSection } from "../SettingsPrimitives"

export function SelfHostedConnection() {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const saveServerUrl = useRemoteVaultStore((state) => state.saveServerUrl)
	const setSelfHosted = useRemoteVaultStore((state) => state.setSelfHosted)
	const unlinkVault = useRemoteVaultStore((state) => state.unlinkVault)
	const [inputValue, setInputValue] = useState(
		syncConfig.serverUrl ?? DEFAULT_SELF_HOSTED_SYNC_SERVER_URL,
	)
	const [saving, setSaving] = useState(false)

	useEffect(() => {
		setInputValue(syncConfig.serverUrl ?? DEFAULT_SELF_HOSTED_SYNC_SERVER_URL)
	}, [syncConfig.serverUrl])

	const handleSave = async () => {
		const trimmed = inputValue.trim().replace(/\/+$/, "")
		if (!vaultPath || !trimmed || trimmed === syncConfig.serverUrl) return
		if (linkedVaultId) {
			const confirmed = await getPlatform().dialog.showConfirm({
				title: "Change sync server?",
				message: "Changing the sync server will unlink this vault from its current remote vault.",
				confirmLabel: "Change server",
				cancelLabel: "Keep current server",
				destructive: true,
			})
			if (!confirmed) {
				setInputValue(syncConfig.serverUrl ?? DEFAULT_SELF_HOSTED_SYNC_SERVER_URL)
				return
			}
			await unlinkVault(vaultPath)
		}
		setSaving(true)
		try {
			await saveServerUrl(vaultPath, trimmed)
		} finally {
			setSaving(false)
		}
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") void handleSave()
	}

	return (
		<SettingsSection
			title="Connection"
			description="Choose Cortex Cloud or point this vault at a self-hosted sync server."
		>
			<SettingsGroup>
				<SettingsField label="Self-hosted sync" htmlFor="self-hosted-sync">
					<Switch
						id="self-hosted-sync"
						checked={syncConfig.selfHosted}
						onCheckedChange={(checked) => vaultPath && void setSelfHosted(vaultPath, checked)}
					/>
				</SettingsField>
				<SettingsField
					label="Sync URL"
					description="Remote vaults and login use this URL for the active vault only."
					htmlFor="server-url"
					controlClassName="max-w-[440px]"
				>
					<div className="flex gap-2">
						<Input
							id="server-url"
							type="url"
							value={inputValue}
							onChange={(event: ChangeEvent<HTMLInputElement>) => setInputValue(event.target.value)}
							onKeyDown={handleKeyDown}
							placeholder={DEFAULT_SELF_HOSTED_SYNC_SERVER_URL}
							disabled={saving}
						/>
						<Button
							variant="secondary"
							size="sm"
							onClick={() => void handleSave()}
							disabled={saving || inputValue.trim() === syncConfig.serverUrl}
							className="shrink-0"
						>
							{saving ? <Loader2 size={14} className="animate-spin" /> : "Save"}
						</Button>
					</div>
				</SettingsField>
			</SettingsGroup>
		</SettingsSection>
	)
}
