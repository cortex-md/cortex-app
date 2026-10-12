import {
	DEFAULT_SELF_HOSTED_SYNC_SERVER_URL,
	useRemoteVaultStore,
	useVaultStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { Button, Input, Switch } from "@cortex/ui"
import { Loader2, ServerIcon } from "lucide-react"
import { type ChangeEvent, type KeyboardEvent, useState } from "react"
import { SettingsField, SettingsGroup, SettingsSection } from "../SettingsPrimitives"

interface ServerUrlFieldProps {
	vaultPath: string | undefined
	savedServerUrl: string | null
}

function ServerUrlField({ vaultPath, savedServerUrl }: ServerUrlFieldProps) {
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const saveServerUrl = useRemoteVaultStore((state) => state.saveServerUrl)
	const unlinkVault = useRemoteVaultStore((state) => state.unlinkVault)
	const initialValue = savedServerUrl ?? DEFAULT_SELF_HOSTED_SYNC_SERVER_URL
	const [inputValue, setInputValue] = useState(initialValue)
	const [saving, setSaving] = useState(false)

	const handleSave = async () => {
		const trimmed = inputValue.trim().replace(/\/+$/, "")
		if (!vaultPath || !trimmed || trimmed === savedServerUrl) return
		if (linkedVaultId) {
			const confirmed = await getPlatform().dialog.showConfirm({
				title: "Change sync server?",
				message: "Changing the sync server will unlink this vault from its current remote vault.",
				confirmLabel: "Change server",
				cancelLabel: "Keep current server",
				destructive: true,
			})
			if (!confirmed) {
				setInputValue(initialValue)
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
		<div className="settings-env-control">
			<Input
				id="server-url"
				size="sm"
				type="url"
				value={inputValue}
				onChange={(event: ChangeEvent<HTMLInputElement>) => setInputValue(event.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={DEFAULT_SELF_HOSTED_SYNC_SERVER_URL}
				disabled={saving}
			/>
			<Button
				variant="secondary"
				size="xs"
				onClick={() => void handleSave()}
				disabled={saving || inputValue.trim() === savedServerUrl}
				className="shrink-0"
			>
				{saving ? <Loader2 size={14} className="animate-spin" /> : "Save"}
			</Button>
		</div>
	)
}

export function SelfHostedConnection() {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const setSelfHosted = useRemoteVaultStore((state) => state.setSelfHosted)

	return (
		<SettingsSection title="Connection">
			<SettingsGroup>
				<SettingsField
					fieldId="sync-self-host.enabled"
					icon={<ServerIcon />}
					htmlFor="self-hosted-sync"
				>
					<Switch
						id="self-hosted-sync"
						size="sm"
						checked={syncConfig.selfHosted}
						onCheckedChange={(checked) => vaultPath && void setSelfHosted(vaultPath, checked)}
					/>
				</SettingsField>
				<SettingsField
					fieldId="sync-self-host.server-url"
					htmlFor="server-url"
					controlClassName="settings-env-control-column"
				>
					<ServerUrlField
						key={syncConfig.serverUrl ?? ""}
						vaultPath={vaultPath}
						savedServerUrl={syncConfig.serverUrl}
					/>
				</SettingsField>
			</SettingsGroup>
		</SettingsSection>
	)
}
